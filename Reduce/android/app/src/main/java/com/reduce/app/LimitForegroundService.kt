package com.reduce.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder

class LimitForegroundService : Service() {
    override fun onCreate() {
        super.onCreate()
        try {
            startForeground(1, buildNotification())
            LimitMonitor.start(this)
        } catch (e: Exception) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        LimitMonitor.stop()
        super.onDestroy()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(): Notification {
        val channelId = "reduce_limit"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Reduce Limit Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            mgr.createNotificationChannel(channel)
        }
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, channelId)
        } else {
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("Reduce is running")
            .setContentText("Monitoring short-video usage time")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .build()
    }
}