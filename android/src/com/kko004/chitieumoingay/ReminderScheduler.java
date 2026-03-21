package com.kko004.chitieumoingay;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

final class ReminderScheduler {
  static final String PREFS_NAME = "expense_reminder_prefs_v1";

  private static final String CHANNEL_ID = "expense_end_of_day_reminder";
  private static final String CHANNEL_NAME = "Nhac nhap chi tieu";
  private static final String CHANNEL_DESCRIPTION = "Thong bao nhac nhap chi tieu cuoi ngay";
  private static final int REMINDER_REQUEST_CODE = 9221;
  private static final int REMINDER_NOTIFICATION_ID = 9222;
  private static final int DEFAULT_REMINDER_HOUR = 21;
  private static final int DEFAULT_REMINDER_MINUTE = 0;
  private static final String DEFAULT_TITLE = "Nhac nhap chi tieu";
  private static final String DEFAULT_MESSAGE = "Hom nay ban chua nhap chi tieu. Hay cap nhat truoc khi ket thuc ngay.";

  private static final String PREF_REMINDER_ENABLED = "reminder_enabled";
  private static final String PREF_REMINDER_HOUR = "reminder_hour";
  private static final String PREF_REMINDER_MINUTE = "reminder_minute";
  private static final String PREF_REMINDER_TITLE = "reminder_title";
  private static final String PREF_REMINDER_MESSAGE = "reminder_message";
  private static final String PREF_REMINDER_LAST_SENT_DATE = "reminder_last_sent_date";
  private static final String PREF_RECORD_STATE_DATE = "record_state_date";
  private static final String PREF_RECORD_STATE_HAS_RECORD = "record_state_has_record";
  private static final String PREF_NOTIFICATION_PERMISSION_REQUESTED = "notification_permission_requested";

  private ReminderScheduler() {}

  static void createNotificationChannel(Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }

    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager == null) {
      return;
    }

    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      NotificationManager.IMPORTANCE_DEFAULT
    );
    channel.setDescription(CHANNEL_DESCRIPTION);
    manager.createNotificationChannel(channel);
  }

  static void markNotificationPermissionRequested(Context context) {
    getPreferences(context).edit().putBoolean(PREF_NOTIFICATION_PERMISSION_REQUESTED, true).apply();
  }

  static boolean wasNotificationPermissionRequested(Context context) {
    return getPreferences(context).getBoolean(PREF_NOTIFICATION_PERMISSION_REQUESTED, false);
  }

  static boolean areNotificationsEnabled(Context context) {
    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager == null) {
      return false;
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && !manager.areNotificationsEnabled()) {
      return false;
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      return context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    return true;
  }

  static void scheduleDailyReminder(Context context, int hour, int minute, String title, String message) {
    int safeHour = clamp(hour, 0, 23);
    int safeMinute = clamp(minute, 0, 59);

    SharedPreferences.Editor editor = getPreferences(context).edit();
    editor.putBoolean(PREF_REMINDER_ENABLED, true);
    editor.putInt(PREF_REMINDER_HOUR, safeHour);
    editor.putInt(PREF_REMINDER_MINUTE, safeMinute);
    editor.putString(PREF_REMINDER_TITLE, sanitizeText(title, DEFAULT_TITLE));
    editor.putString(PREF_REMINDER_MESSAGE, sanitizeText(message, DEFAULT_MESSAGE));
    editor.apply();

    scheduleStoredReminder(context);
  }

  static void cancelDailyReminder(Context context) {
    SharedPreferences.Editor editor = getPreferences(context).edit();
    editor.putBoolean(PREF_REMINDER_ENABLED, false);
    editor.remove(PREF_REMINDER_LAST_SENT_DATE);
    editor.apply();

    AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    PendingIntent pendingIntent = createReminderPendingIntent(
      context,
      DEFAULT_REMINDER_HOUR,
      DEFAULT_REMINDER_MINUTE,
      DEFAULT_TITLE,
      DEFAULT_MESSAGE,
      true
    );
    if (pendingIntent == null) {
      return;
    }
    if (alarmManager != null) {
      alarmManager.cancel(pendingIntent);
    }
    pendingIntent.cancel();
  }

  static void scheduleStoredReminder(Context context) {
    SharedPreferences preferences = getPreferences(context);
    if (!preferences.getBoolean(PREF_REMINDER_ENABLED, false)) {
      return;
    }

    int hour = preferences.getInt(PREF_REMINDER_HOUR, DEFAULT_REMINDER_HOUR);
    int minute = preferences.getInt(PREF_REMINDER_MINUTE, DEFAULT_REMINDER_MINUTE);
    String title = sanitizeText(preferences.getString(PREF_REMINDER_TITLE, DEFAULT_TITLE), DEFAULT_TITLE);
    String message = sanitizeText(preferences.getString(PREF_REMINDER_MESSAGE, DEFAULT_MESSAGE), DEFAULT_MESSAGE);

    long nextTriggerAt = computeNextTriggerTime(System.currentTimeMillis(), hour, minute);
    scheduleReminderAlarm(context, nextTriggerAt, hour, minute, title, message);
  }

  static void restoreReminderAfterReboot(Context context) {
    scheduleStoredReminder(context);
  }

  static void updateTodayRecordState(Context context, String dateKey, boolean hasRecordToday) {
    String normalizedDate = String.valueOf(dateKey == null ? "" : dateKey).trim();
    if (!normalizedDate.matches("\\d{4}-\\d{2}-\\d{2}")) {
      normalizedDate = getTodayDateKey();
    }

    SharedPreferences.Editor editor = getPreferences(context).edit();
    editor.putString(PREF_RECORD_STATE_DATE, normalizedDate);
    editor.putBoolean(PREF_RECORD_STATE_HAS_RECORD, hasRecordToday);
    editor.apply();
  }

  static void maybeSendReminderNow(Context context) {
    SharedPreferences preferences = getPreferences(context);
    if (!preferences.getBoolean(PREF_REMINDER_ENABLED, false)) {
      return;
    }

    int hour = preferences.getInt(PREF_REMINDER_HOUR, DEFAULT_REMINDER_HOUR);
    int minute = preferences.getInt(PREF_REMINDER_MINUTE, DEFAULT_REMINDER_MINUTE);
    Calendar now = Calendar.getInstance();
    if (now.get(Calendar.HOUR_OF_DAY) < hour) {
      return;
    }
    if (now.get(Calendar.HOUR_OF_DAY) == hour && now.get(Calendar.MINUTE) < minute) {
      return;
    }

    String title = sanitizeText(preferences.getString(PREF_REMINDER_TITLE, DEFAULT_TITLE), DEFAULT_TITLE);
    String message = sanitizeText(preferences.getString(PREF_REMINDER_MESSAGE, DEFAULT_MESSAGE), DEFAULT_MESSAGE);
    maybeDispatchReminder(context, title, message);
    scheduleStoredReminder(context);
  }

  static void handleReminderAlarm(Context context, Intent intent) {
    if (intent == null) {
      scheduleStoredReminder(context);
      return;
    }

    SharedPreferences preferences = getPreferences(context);
    if (!preferences.getBoolean(PREF_REMINDER_ENABLED, false)) {
      return;
    }

    String title = sanitizeText(intent.getStringExtra("title"), preferences.getString(PREF_REMINDER_TITLE, DEFAULT_TITLE));
    String message = sanitizeText(intent.getStringExtra("message"), preferences.getString(PREF_REMINDER_MESSAGE, DEFAULT_MESSAGE));
    maybeDispatchReminder(context, title, message);
    scheduleStoredReminder(context);
  }

  private static boolean maybeDispatchReminder(Context context, String title, String message) {
    if (!areNotificationsEnabled(context)) {
      return false;
    }

    String today = getTodayDateKey();
    if (!canNotifyOnDate(context, today)) {
      return false;
    }

    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager == null) {
      return false;
    }

    createNotificationChannel(context);

    Intent openAppIntent = new Intent(context, MainActivity.class);
    openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent contentIntent = PendingIntent.getActivity(
      context,
      0,
      openAppIntent,
      getPendingIntentFlags(false)
    );

    Notification.Builder builder;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      builder = new Notification.Builder(context, CHANNEL_ID);
    } else {
      builder = new Notification.Builder(context);
      builder.setPriority(Notification.PRIORITY_DEFAULT);
    }

    builder
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle(title)
      .setContentText(message)
      .setStyle(new Notification.BigTextStyle().bigText(message))
      .setAutoCancel(true)
      .setContentIntent(contentIntent)
      .setWhen(System.currentTimeMillis());

    manager.notify(REMINDER_NOTIFICATION_ID, builder.build());
    getPreferences(context).edit().putString(PREF_REMINDER_LAST_SENT_DATE, today).apply();
    return true;
  }

  private static boolean canNotifyOnDate(Context context, String dateKey) {
    SharedPreferences preferences = getPreferences(context);
    String lastSentDate = preferences.getString(PREF_REMINDER_LAST_SENT_DATE, "");
    if (dateKey.equals(lastSentDate)) {
      return false;
    }

    String trackedDate = preferences.getString(PREF_RECORD_STATE_DATE, "");
    boolean hasRecordToday = preferences.getBoolean(PREF_RECORD_STATE_HAS_RECORD, false);
    if (dateKey.equals(trackedDate) && hasRecordToday) {
      return false;
    }

    return true;
  }

  private static void scheduleReminderAlarm(
    Context context,
    long triggerAtMillis,
    int hour,
    int minute,
    String title,
    String message
  ) {
    AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (alarmManager == null) {
      return;
    }

    PendingIntent pendingIntent = createReminderPendingIntent(context, hour, minute, title, message, false);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
      return;
    }

    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
  }

  private static PendingIntent createReminderPendingIntent(
    Context context,
    int hour,
    int minute,
    String title,
    String message,
    boolean noCreate
  ) {
    Intent intent = new Intent(context, ReminderReceiver.class);
    intent.putExtra("hour", hour);
    intent.putExtra("minute", minute);
    intent.putExtra("title", sanitizeText(title, DEFAULT_TITLE));
    intent.putExtra("message", sanitizeText(message, DEFAULT_MESSAGE));
    int flags = getPendingIntentFlags(noCreate);
    return PendingIntent.getBroadcast(context, REMINDER_REQUEST_CODE, intent, flags);
  }

  private static int getPendingIntentFlags(boolean noCreate) {
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (noCreate) {
      flags = PendingIntent.FLAG_NO_CREATE;
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      flags |= PendingIntent.FLAG_IMMUTABLE;
    }
    return flags;
  }

  private static long computeNextTriggerTime(long nowMillis, int hour, int minute) {
    Calendar calendar = Calendar.getInstance();
    calendar.setTimeInMillis(nowMillis);
    calendar.set(Calendar.HOUR_OF_DAY, clamp(hour, 0, 23));
    calendar.set(Calendar.MINUTE, clamp(minute, 0, 59));
    calendar.set(Calendar.SECOND, 0);
    calendar.set(Calendar.MILLISECOND, 0);

    if (calendar.getTimeInMillis() <= nowMillis) {
      calendar.add(Calendar.DAY_OF_YEAR, 1);
    }

    return calendar.getTimeInMillis();
  }

  private static String sanitizeText(String value, String fallback) {
    String normalized = String.valueOf(value == null ? "" : value).trim();
    if (normalized.isEmpty()) {
      return fallback;
    }
    if (normalized.length() > 120) {
      return normalized.substring(0, 120);
    }
    return normalized;
  }

  private static String getTodayDateKey() {
    SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
    return formatter.format(new Date());
  }

  private static int clamp(int value, int min, int max) {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  private static SharedPreferences getPreferences(Context context) {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
  }
}
