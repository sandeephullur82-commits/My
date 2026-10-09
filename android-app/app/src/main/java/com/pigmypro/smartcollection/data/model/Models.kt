package com.pigmypro.smartcollection.data.model

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

data class LoanCycle(
    val cycleNumber: Int,
    val loanAmount: Double,
    val paidAmount: Double,
    val pendingAmount: Double,
    val interestAdded: Double? = null,
    val interestType: String? = null,
    val interestRate: Double? = null,
    val newTotalDebt: Double? = null,
    val startDate: Long,
    val endDate: Long,
    val completedAt: Long,
    val durationDays: Int,
    val status: String, // "completed", "matured_renewed", "rolled_over"
    val rolloverAction: String? = null, // "deducted_from_payout", "absorbed", "cleared", "none"
    val advanceSavings: Double? = null,
    val advanceApplied: Double? = null,
    val notes: String? = null
)

data class AuditRecord(
    val timestamp: Long = System.currentTimeMillis(),
    val oldValue: String,
    val newValue: String,
    val action: String
)

data class OverdueResult(
    val isOverdue: Boolean,
    val amount: Double,
    val expectedPaid: Double,
    val daysMissing: Int
)

data class RenewalData(
    val newLoanAmount: Double,
    val durationDays: Int,
    val startDate: Long,
    val endDate: Long,
    val rolloverAction: String = "absorbed",
    val frequency: String = "daily",
    val frequencyDays: Int = 1,
    val advanceApplied: Double = 0.0,
    val interestRate: Double? = null,
    val interestAmount: Double? = null,
    val notes: String? = null
)

data class MaturedRenewalData(
    val interestAmount: Double,
    val interestType: String = "flat", // "percentage" or "flat"
    val interestRate: Double? = null,
    val newTotalDebt: Double,
    val durationDays: Int,
    val startDate: Long,
    val endDate: Long,
    val notes: String? = null
)

object ConvertersHelper {
    private val gson = Gson()

    fun cyclesToJson(cycles: List<LoanCycle>?): String? {
        if (cycles == null) return null
        return gson.toJson(cycles)
    }

    fun jsonToCycles(json: String?): List<LoanCycle> {
        if (json.isNullOrEmpty()) return emptyList()
        val type = object : TypeToken<List<LoanCycle>>() {}.type
        return try {
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun historyToJson(history: List<AuditRecord>?): String? {
        if (history == null) return null
        return gson.toJson(history)
    }

    fun jsonToHistory(json: String?): List<AuditRecord> {
        if (json.isNullOrEmpty()) return emptyList()
        val type = object : TypeToken<List<AuditRecord>>() {}.type
        return try {
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }
}
