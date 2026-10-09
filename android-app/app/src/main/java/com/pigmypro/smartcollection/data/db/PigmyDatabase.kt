package com.pigmypro.smartcollection.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.pigmypro.smartcollection.data.dao.CustomerDao
import com.pigmypro.smartcollection.data.dao.NotificationDao
import com.pigmypro.smartcollection.data.dao.TransactionDao
import com.pigmypro.smartcollection.data.entity.CustomerEntity
import com.pigmypro.smartcollection.data.entity.NotificationEntity
import com.pigmypro.smartcollection.data.entity.TransactionEntity

@Database(
    entities = [
        CustomerEntity::class,
        TransactionEntity::class,
        NotificationEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class PigmyDatabase : RoomDatabase() {
    abstract fun customerDao(): CustomerDao
    abstract fun transactionDao(): TransactionDao
    abstract fun notificationDao(): NotificationDao

    companion object {
        @Volatile
        private var INSTANCE: PigmyDatabase? = null

        fun getDatabase(context: Context): PigmyDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    PigmyDatabase::class.java,
                    "pigmy_pro_database"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
