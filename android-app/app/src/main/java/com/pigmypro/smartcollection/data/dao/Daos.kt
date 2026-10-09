package com.pigmypro.smartcollection.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.pigmypro.smartcollection.data.entity.CustomerEntity
import com.pigmypro.smartcollection.data.entity.NotificationEntity
import com.pigmypro.smartcollection.data.entity.TransactionEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CustomerDao {
    @Query("SELECT * FROM customers WHERE isDeleted = 0 ORDER BY id ASC")
    fun getAllActiveCustomersFlow(): Flow<List<CustomerEntity>>

    @Query("SELECT * FROM customers WHERE isDeleted = 0 ORDER BY id ASC")
    suspend fun getAllActiveCustomers(): List<CustomerEntity>

    @Query("SELECT * FROM customers WHERE id = :id LIMIT 1")
    suspend fun getCustomerById(id: String): CustomerEntity?

    @Query("SELECT * FROM customers WHERE id = :id LIMIT 1")
    fun getCustomerByIdFlow(id: String): Flow<CustomerEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(customer: CustomerEntity)

    @Query("UPDATE customers SET isDeleted = 1, updatedAt = :timestamp WHERE id = :id")
    suspend fun markDeleted(id: String, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE customers SET isDeleted = 0, updatedAt = :timestamp WHERE id = :id")
    suspend fun markRestored(id: String, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE customers SET isPinned = :isPinned, updatedAt = :timestamp WHERE id = :id")
    suspend fun togglePin(id: String, isPinned: Boolean, timestamp: Long = System.currentTimeMillis())

    @Query("SELECT id FROM customers ORDER BY id DESC")
    suspend fun getAllCustomerIds(): List<String>

    @Query("DELETE FROM customers")
    suspend fun deleteAll()
}

@Dao
interface TransactionDao {
    @Query("SELECT * FROM transactions WHERE isDeleted = 0 ORDER BY timestamp DESC")
    fun getAllActiveTransactionsFlow(): Flow<List<TransactionEntity>>

    @Query("SELECT * FROM transactions WHERE isDeleted = 0 ORDER BY timestamp DESC")
    suspend fun getAllActiveTransactions(): List<TransactionEntity>

    @Query("SELECT * FROM transactions WHERE customerId = :customerId AND isDeleted = 0 ORDER BY timestamp DESC")
    fun getTransactionsForCustomerFlow(customerId: String): Flow<List<TransactionEntity>>

    @Query("SELECT * FROM transactions WHERE customerId = :customerId AND isDeleted = 0 ORDER BY timestamp DESC")
    suspend fun getTransactionsForCustomer(customerId: String): List<TransactionEntity>

    @Query("SELECT * FROM transactions WHERE id = :id LIMIT 1")
    suspend fun getTransactionById(id: String): TransactionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(transaction: TransactionEntity)

    @Query("UPDATE transactions SET isDeleted = 1, updatedAt = :timestamp WHERE id = :id")
    suspend fun markDeleted(id: String, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE transactions SET isDeleted = 0, updatedAt = :timestamp WHERE id = :id")
    suspend fun markRestored(id: String, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE transactions SET isDeleted = 1, updatedAt = :timestamp WHERE customerId = :customerId")
    suspend fun markDeletedByCustomerId(customerId: String, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE transactions SET isDeleted = 0, updatedAt = :timestamp WHERE customerId = :customerId")
    suspend fun markRestoredByCustomerId(customerId: String, timestamp: Long = System.currentTimeMillis())

    @Query("DELETE FROM transactions")
    suspend fun deleteAll()
}

@Dao
interface NotificationDao {
    @Query("SELECT * FROM notifications ORDER BY timestamp DESC")
    fun getAllNotificationsFlow(): Flow<List<NotificationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(notification: NotificationEntity)

    @Query("UPDATE notifications SET isRead = 1 WHERE id = :id")
    suspend fun markAsRead(id: String)

    @Query("DELETE FROM notifications WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM notifications")
    suspend fun deleteAll()
}
