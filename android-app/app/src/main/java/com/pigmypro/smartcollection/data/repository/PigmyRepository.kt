package com.pigmypro.smartcollection.data.repository

import com.pigmypro.smartcollection.data.dao.CustomerDao
import com.pigmypro.smartcollection.data.dao.NotificationDao
import com.pigmypro.smartcollection.data.dao.TransactionDao
import com.pigmypro.smartcollection.data.entity.CustomerEntity
import com.pigmypro.smartcollection.data.entity.NotificationEntity
import com.pigmypro.smartcollection.data.entity.TransactionEntity
import com.pigmypro.smartcollection.data.model.*
import kotlinx.coroutines.flow.Flow
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class PigmyRepository(
    private val customerDao: CustomerDao,
    private val transactionDao: TransactionDao,
    private val notificationDao: NotificationDao
) {
    val customersFlow: Flow<List<CustomerEntity>> = customerDao.getAllActiveCustomersFlow()
    val transactionsFlow: Flow<List<TransactionEntity>> = transactionDao.getAllActiveTransactionsFlow()
    val notificationsFlow: Flow<List<NotificationEntity>> = notificationDao.getAllNotificationsFlow()

    suspend fun getNextCustomerId(): String {
        val ids = customerDao.getAllCustomerIds()
        val parsed = ids
            .filter { it.startsWith("CUST-") }
            .mapNotNull { it.replace("CUST-", "").toIntOrNull() }
            .sortedDescending()
        val next = if (parsed.isEmpty()) 1 else parsed[0] + 1
        return "CUST-${next.toString().padStart(3, '0')}"
    }

    fun calculateOverdue(customer: CustomerEntity): OverdueResult {
        if (customer.isDeleted) return OverdueResult(false, 0.0, 0.0, 0)

        val now = System.currentTimeMillis()
        if (now < customer.startDate) return OverdueResult(false, 0.0, 0.0, 0)

        val totalLoan = customer.loanAmount
        val durationDays = max(1, ((customer.endDate - customer.startDate) / (1000.0 * 60 * 60 * 24)).roundToInt())
        val dailyInstallment = totalLoan / durationDays
        val daysSinceStart = min(durationDays, ((now - customer.startDate) / (1000 * 60 * 60 * 24)).toInt())

        val expectedPaid = (daysSinceStart * dailyInstallment).toInt().toDouble()
        val actualPaid = customer.paid
        val isOverdue = actualPaid < expectedPaid
        val amount = max(0.0, expectedPaid - actualPaid)
        val daysMissing = (amount / if (dailyInstallment == 0.0) 1.0 else dailyInstallment).toInt()

        return OverdueResult(isOverdue, amount, expectedPaid, daysMissing)
    }

    suspend fun saveCustomer(customer: CustomerEntity) {
        val loanAmount = max(0.0, customer.loanAmount)
        val cleanName = customer.name.trim()
        val cleanPhone = customer.phone.trim().replace(Regex("[^0-9]"), "")

        val entity = customer.copy(
            name = cleanName,
            phone = cleanPhone,
            loan = loanAmount,
            loanAmount = loanAmount,
            totalLoan = loanAmount,
            updatedAt = System.currentTimeMillis()
        )
        customerDao.insertOrUpdate(entity)
    }

    suspend fun togglePin(customerId: String, isPinned: Boolean) {
        customerDao.togglePin(customerId, isPinned)
    }

    suspend fun deleteCustomer(customerId: String) {
        val now = System.currentTimeMillis()
        customerDao.markDeleted(customerId, now)
        transactionDao.markDeletedByCustomerId(customerId, now)
    }

    suspend fun restoreCustomer(customerId: String) {
        val now = System.currentTimeMillis()
        customerDao.markRestored(customerId, now)
        transactionDao.markRestoredByCustomerId(customerId, now)
    }

    suspend fun saveTransaction(tx: TransactionEntity, customer: CustomerEntity, oldTx: TransactionEntity? = null): Boolean {
        var paidDiff = 0.0
        var pendingDiff = 0.0
        var advanceDiff = 0.0

        if (oldTx != null && oldTx.status == "paid" && oldTx.type != "NP" && oldTx.type != "unsettled") {
            paidDiff -= oldTx.amount
            pendingDiff += oldTx.amount
        }

        val isNP = tx.type == "NP" || tx.type == "unsettled" || tx.status == "unsettled"
        val isActualPayment = (tx.status == "paid" || tx.status.isEmpty()) && !isNP

        val currentPending = customer.pending
        var isAdvanceTx = tx.isAdvance

        if (isActualPayment) {
            val amt = tx.amount
            if (currentPending <= 0.0 || isAdvanceTx) {
                advanceDiff += amt
                paidDiff += amt
                pendingDiff = 0.0
                isAdvanceTx = true
            } else if (amt > currentPending) {
                val excess = amt - currentPending
                paidDiff += amt
                pendingDiff -= currentPending
                advanceDiff += excess
                isAdvanceTx = true
            } else {
                paidDiff += amt;
                pendingDiff -= amt;
            }
        }

        val now = System.currentTimeMillis()
        val newPaid = customer.paid + paidDiff
        val newPending = max(0.0, customer.pending + pendingDiff)
        val newAdvance = max(0.0, customer.advanceBalance + advanceDiff)

        val updatedCustomer = customer.copy(
            paid = newPaid,
            pending = newPending,
            advanceBalance = newAdvance,
            updatedAt = now,
            lastPayment = if (isActualPayment) now else customer.lastPayment
        )

        val effectiveStatus = if (tx.status.isEmpty()) (if (isNP) "unsettled" else "paid") else tx.status
        val effectiveType = if (tx.type.isEmpty()) (if (isNP) "unsettled" else "cash") else tx.type

        val cleanedTx = tx.copy(
            customerId = customer.id,
            status = effectiveStatus,
            type = effectiveType,
            isAdvance = isAdvanceTx,
            isDeleted = false,
            updatedAt = now,
            paidAt = if (isActualPayment) (tx.paidAt ?: now) else null,
            unsettledAt = if (isNP) (tx.unsettledAt ?: now) else null
        )

        customerDao.insertOrUpdate(updatedCustomer)
        transactionDao.insertOrUpdate(cleanedTx)
        return true
    }

    suspend fun updateTransaction(
        txId: String,
        updates: TransactionEntity,
        oldTx: TransactionEntity,
        customer: CustomerEntity,
        actionName: String
    ) {
        val newType = updates.type
        val newAmount = updates.amount
        var newStatus = updates.status

        if (newStatus.isEmpty()) {
            newStatus = when (newType) {
                "unsettled", "NP" -> "unsettled"
                "cash", "phonepe" -> "paid"
                else -> "pending"
            }
        }

        val oldEffectiveAmt = if (oldTx.status == "paid" && oldTx.type != "NP" && oldTx.type != "unsettled") oldTx.amount else 0.0
        val newEffectiveAmt = if (newStatus == "paid" && newType != "NP" && newType != "unsettled") newAmount else 0.0

        val paidDiff = newEffectiveAmt - oldEffectiveAmt
        val pendingDiff = -paidDiff

        val existingHistory = ConvertersHelper.jsonToHistory(oldTx.historyJson)
        val auditRecord = AuditRecord(
            oldValue = "amount:${oldTx.amount}, type:${oldTx.type}, status:${oldTx.status}",
            newValue = "amount:$newAmount, type:$newType, status:$newStatus",
            action = actionName
        )
        val updatedHistory = existingHistory + auditRecord

        val now = System.currentTimeMillis()
        val updatedCustomer = customer.copy(
            paid = customer.paid + paidDiff,
            pending = max(0.0, customer.pending + pendingDiff),
            updatedAt = now,
            lastPayment = if (newStatus == "paid") now else customer.lastPayment
        )

        val updatedTx = updates.copy(
            id = txId,
            status = newStatus,
            type = newType,
            amount = newAmount,
            historyJson = ConvertersHelper.historyToJson(updatedHistory),
            updatedAt = now,
            paidAt = if (newStatus == "paid") (updates.paidAt ?: now) else null,
            unsettledAt = if (newStatus == "unsettled") (updates.unsettledAt ?: now) else null
        )

        customerDao.insertOrUpdate(updatedCustomer)
        transactionDao.insertOrUpdate(updatedTx)
    }

    suspend fun deleteTransaction(tx: TransactionEntity, customer: CustomerEntity) {
        val now = System.currentTimeMillis()

        if (tx.status == "paid" && tx.type != "NP" && tx.type != "unsettled") {
            val currentAdvance = customer.advanceBalance
            var newAdvance = currentAdvance
            var newPending = customer.pending

            if (tx.isWithdrawal) {
                newAdvance = currentAdvance + tx.amount
            } else if (currentAdvance > 0 && (tx.isAdvance || newPending <= 0)) {
                newAdvance = max(0.0, currentAdvance - tx.amount)
            } else {
                newPending += tx.amount
            }

            val updatedCustomer = customer.copy(
                paid = if (tx.isWithdrawal) customer.paid else max(0.0, customer.paid - tx.amount),
                pending = newPending,
                advanceBalance = newAdvance,
                updatedAt = now
            )
            customerDao.insertOrUpdate(updatedCustomer)
        }

        transactionDao.markDeleted(tx.id, now)
    }

    suspend fun undoDeleteTransaction(tx: TransactionEntity, customer: CustomerEntity) {
        val now = System.currentTimeMillis()

        if (tx.status == "paid" && tx.type != "NP" && tx.type != "unsettled") {
            val currentAdvance = customer.advanceBalance
            var newAdvance = currentAdvance
            var newPending = customer.pending

            if (tx.isWithdrawal) {
                newAdvance = max(0.0, currentAdvance - tx.amount)
            } else if (currentAdvance > 0 && tx.isAdvance) {
                newAdvance = currentAdvance + tx.amount
            } else {
                newPending = max(0.0, newPending - tx.amount)
            }

            val updatedCustomer = customer.copy(
                paid = if (tx.isWithdrawal) customer.paid else customer.paid + tx.amount,
                pending = newPending,
                advanceBalance = newAdvance,
                updatedAt = now
            )
            customerDao.insertOrUpdate(updatedCustomer)
        }

        transactionDao.markRestored(tx.id, now)
    }

    suspend fun renewCustomerLoan(customer: CustomerEntity, renewal: RenewalData): CustomerEntity {
        val currentCycleNum = customer.currentCycle
        val oldPending = max(0.0, customer.pending)
        val oldPaid = customer.paid
        val oldLoan = customer.loanAmount

        val currentAdvance = customer.advanceBalance
        val advanceToApply = min(currentAdvance, max(0.0, renewal.advanceApplied))
        val remainingAdvance = max(0.0, currentAdvance - advanceToApply)

        val newLoanTotal = renewal.newLoanAmount
        val initialPaid = advanceToApply
        val initialPending = max(0.0, newLoanTotal - initialPaid)

        val completedCycle = LoanCycle(
            cycleNumber = currentCycleNum,
            loanAmount = oldLoan,
            paidAmount = oldPaid,
            pendingAmount = oldPending,
            advanceSavings = currentAdvance,
            advanceApplied = advanceToApply,
            interestAdded = renewal.interestAmount,
            interestRate = renewal.interestRate,
            startDate = customer.startDate,
            endDate = customer.endDate,
            completedAt = System.currentTimeMillis(),
            durationDays = customer.durationDays,
            status = if (oldPending <= 0) "completed" else "rolled_over",
            rolloverAction = if (oldPending > 0) renewal.rolloverAction else "none",
            notes = customer.notes
        )

        val existingCycles = ConvertersHelper.jsonToCycles(customer.cyclesJson)
        val updatedCycles = existingCycles + completedCycle
        val newCycleNum = currentCycleNum + 1
        val now = System.currentTimeMillis()

        val updatedCustomer = customer.copy(
            loan = newLoanTotal,
            loanAmount = newLoanTotal,
            totalLoan = newLoanTotal,
            paid = initialPaid,
            pending = initialPending,
            advanceBalance = remainingAdvance,
            startDate = renewal.startDate,
            endDate = renewal.endDate,
            durationDays = renewal.durationDays,
            frequency = renewal.frequency,
            frequencyDays = renewal.frequencyDays,
            currentCycle = newCycleNum,
            cyclesJson = ConvertersHelper.cyclesToJson(updatedCycles),
            lastRenewalDate = now,
            renewalStatus = null,
            renewalRejectedAt = null,
            notes = renewal.notes ?: if (advanceToApply > 0) "Cycle #$newCycleNum New Loan (₹${advanceToApply.toInt()} Advance Applied)" else "Cycle #$newCycleNum New Loan",
            updatedAt = now
        )

        customerDao.insertOrUpdate(updatedCustomer)
        return updatedCustomer
    }

    suspend fun renewMaturedLoan(customer: CustomerEntity, renewal: MaturedRenewalData): CustomerEntity {
        val currentCycleNum = customer.currentCycle
        val oldPending = max(0.0, customer.pending)
        val oldPaid = customer.paid
        val oldLoan = customer.loanAmount

        val completedCycle = LoanCycle(
            cycleNumber = currentCycleNum,
            loanAmount = oldLoan,
            paidAmount = oldPaid,
            pendingAmount = oldPending,
            interestAdded = renewal.interestAmount,
            interestType = renewal.interestType,
            interestRate = renewal.interestRate,
            newTotalDebt = renewal.newTotalDebt,
            startDate = customer.startDate,
            endDate = customer.endDate,
            completedAt = System.currentTimeMillis(),
            durationDays = customer.durationDays,
            status = "matured_renewed",
            notes = customer.notes
        )

        val existingCycles = ConvertersHelper.jsonToCycles(customer.cyclesJson)
        val updatedCycles = existingCycles + completedCycle
        val newCycleNum = currentCycleNum + 1
        val now = System.currentTimeMillis()

        val updatedCustomer = customer.copy(
            loan = renewal.newTotalDebt,
            loanAmount = renewal.newTotalDebt,
            totalLoan = renewal.newTotalDebt,
            paid = 0.0,
            pending = renewal.newTotalDebt,
            startDate = renewal.startDate,
            endDate = renewal.endDate,
            durationDays = renewal.durationDays,
            currentCycle = newCycleNum,
            cyclesJson = ConvertersHelper.cyclesToJson(updatedCycles),
            renewalStatus = null,
            renewalRejectedAt = null,
            lastRenewalDate = now,
            notes = renewal.notes ?: "Cycle #$newCycleNum Renewal (Restructured ₹${oldPending.toInt()} + ₹${renewal.interestAmount.toInt()} interest)",
            updatedAt = now
        )

        customerDao.insertOrUpdate(updatedCustomer)
        return updatedCustomer
    }

    suspend fun withdrawAdvanceDeposit(
        customer: CustomerEntity,
        amount: Double,
        payoutType: String,
        notes: String?
    ): Pair<TransactionEntity, CustomerEntity> {
        require(amount > 0) { "Withdrawal amount must be greater than zero" }
        require(amount <= customer.advanceBalance) { "Insufficient advance balance. Available: ₹${customer.advanceBalance}" }

        val txId = UUID.randomUUID().toString()
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val now = System.currentTimeMillis()

        val newAdvance = max(0.0, customer.advanceBalance - amount)
        val updatedCustomer = customer.copy(
            advanceBalance = newAdvance,
            updatedAt = now
        )

        val tx = TransactionEntity(
            id = txId,
            customerId = customer.id,
            amount = amount,
            type = payoutType,
            status = "paid",
            date = todayStr,
            timestamp = now,
            paidAt = now,
            isAdvance = true,
            isWithdrawal = true,
            notes = notes ?: "Advance deposit withdrawal of ₹${amount.toInt()} via ${if (payoutType == "phonepe") "PhonePe UPI" else "Cash"}"
        )

        customerDao.insertOrUpdate(updatedCustomer)
        transactionDao.insertOrUpdate(tx)

        return Pair(tx, updatedCustomer)
    }

    suspend fun clearAllData() {
        customerDao.deleteAll()
        transactionDao.deleteAll()
        notificationDao.deleteAll()
    }

    suspend fun markNotificationRead(id: String) {
        notificationDao.markAsRead(id)
    }

    suspend fun deleteNotification(id: String) {
        notificationDao.deleteById(id)
    }

    suspend fun addNotification(notification: NotificationEntity) {
        notificationDao.insertOrUpdate(notification)
    }
}
