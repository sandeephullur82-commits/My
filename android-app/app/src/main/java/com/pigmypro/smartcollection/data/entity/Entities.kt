package com.pigmypro.smartcollection.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "customers")
data class CustomerEntity(
    @PrimaryKey val id: String,
    val displayId: String? = null,
    val name: String,
    val phone: String,
    val loan: Double,
    val loanAmount: Double = loan,
    val totalLoan: Double = loan,
    val paid: Double = 0.0,
    val pending: Double = loan - paid,
    val startDate: Long,
    val endDate: Long,
    val frequency: String = "daily",
    val frequencyDays: Int = 1,
    val durationDays: Int = 100,
    val notes: String? = null,
    val info: String? = null,
    val uniqueKey: String? = null,
    val isDeleted: Boolean = false,
    val isPinned: Boolean = false,
    val currentCycle: Int = 1,
    val cyclesJson: String? = null,
    val advanceBalance: Double = 0.0,
    val lastRenewalDate: Long? = null,
    val renewalStatus: String? = null, // "pending_review", "rejected", "renewed"
    val renewalRejectedAt: Long? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val lastPayment: Long? = null
)

@Entity(tableName = "transactions")
data class TransactionEntity(
    @PrimaryKey val id: String,
    val customerId: String,
    val amount: Double,
    val type: String, // "cash", "phonepe", "unsettled", "NP"
    val status: String, // "paid", "pending", "unsettled", "settled"
    val entryStatus: String = "active", // "active", "modified"
    val parentId: String? = null,
    val date: String, // YYYY-MM-DD
    val timestamp: Long = System.currentTimeMillis(),
    val paidAt: Long? = null,
    val unsettledAt: Long? = null,
    val npMarkedAt: Long? = null,
    val npMarkedDate: String? = null,
    val convertedFromNP: Boolean = false,
    val settledAt: Long? = null,
    val settledFromNpId: String? = null,
    val settledMethod: String? = null, // "cash", "phonepe"
    val isSettled: Boolean = false,
    val isAdvance: Boolean = false,
    val isWithdrawal: Boolean = false,
    val createdBy: String = "agent",
    val isDeleted: Boolean = false,
    val notes: String? = null,
    val historyJson: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "notifications")
data class NotificationEntity(
    @PrimaryKey val id: String,
    val userId: String? = null,
    val type: String = "info", // "success", "error", "info", "transaction", "warning", "critical"
    val priority: String = "medium", // "high", "medium", "low"
    val title: String,
    val message: String? = null,
    val amount: Double? = null,
    val customerName: String? = null,
    val customerPhone: String? = null,
    val customerId: String? = null,
    val alertCategory: String? = null, // "upcoming", "due_today", "overdue", "collection", "general"
    val dueDate: Long? = null,
    val diffDays: Int? = null,
    val paymentType: String? = null,
    val isRead: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
)
