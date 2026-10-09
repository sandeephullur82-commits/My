package com.pigmypro.smartcollection.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.pigmypro.smartcollection.data.entity.CustomerEntity
import com.pigmypro.smartcollection.data.entity.NotificationEntity
import com.pigmypro.smartcollection.data.entity.TransactionEntity
import com.pigmypro.smartcollection.data.model.MaturedRenewalData
import com.pigmypro.smartcollection.data.model.OverdueResult
import com.pigmypro.smartcollection.data.model.RenewalData
import com.pigmypro.smartcollection.data.repository.PigmyRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class PigmyViewModel(val repository: PigmyRepository) : ViewModel() {

    val customers: StateFlow<List<CustomerEntity>> = repository.customersFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val transactions: StateFlow<List<TransactionEntity>> = repository.transactionsFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val notifications: StateFlow<List<NotificationEntity>> = repository.notificationsFlow
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    suspend fun getNextCustomerId(): String {
        return repository.getNextCustomerId()
    }

    fun calculateOverdue(customer: CustomerEntity): OverdueResult {
        return repository.calculateOverdue(customer)
    }

    fun saveCustomer(customer: CustomerEntity, onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            repository.saveCustomer(customer)
            onComplete()
        }
    }

    fun togglePin(customerId: String, currentPinState: Boolean) {
        viewModelScope.launch {
            repository.togglePin(customerId, !currentPinState)
        }
    }

    fun deleteCustomer(customerId: String) {
        viewModelScope.launch {
            repository.deleteCustomer(customerId)
        }
    }

    fun restoreCustomer(customerId: String) {
        viewModelScope.launch {
            repository.restoreCustomer(customerId)
        }
    }

    fun saveTransaction(
        tx: TransactionEntity,
        customer: CustomerEntity,
        oldTx: TransactionEntity? = null,
        onComplete: (Boolean) -> Unit = {}
    ) {
        viewModelScope.launch {
            val success = repository.saveTransaction(tx, customer, oldTx)
            onComplete(success)
        }
    }

    fun updateTransaction(
        txId: String,
        updates: TransactionEntity,
        oldTx: TransactionEntity,
        customer: CustomerEntity,
        actionName: String,
        onComplete: () -> Unit = {}
    ) {
        viewModelScope.launch {
            repository.updateTransaction(txId, updates, oldTx, customer, actionName)
            onComplete()
        }
    }

    fun deleteTransaction(tx: TransactionEntity, customer: CustomerEntity, onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            repository.deleteTransaction(tx, customer)
            onComplete()
        }
    }

    fun undoDeleteTransaction(tx: TransactionEntity, customer: CustomerEntity, onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            repository.undoDeleteTransaction(tx, customer)
            onComplete()
        }
    }

    fun renewCustomerLoan(customer: CustomerEntity, renewal: RenewalData, onComplete: (CustomerEntity) -> Unit = {}) {
        viewModelScope.launch {
            val updated = repository.renewCustomerLoan(customer, renewal)
            onComplete(updated)
        }
    }

    fun renewMaturedLoan(customer: CustomerEntity, renewal: MaturedRenewalData, onComplete: (CustomerEntity) -> Unit = {}) {
        viewModelScope.launch {
            val updated = repository.renewMaturedLoan(customer, renewal)
            onComplete(updated)
        }
    }

    fun withdrawAdvanceDeposit(
        customer: CustomerEntity,
        amount: Double,
        payoutType: String,
        notes: String?,
        onSuccess: (TransactionEntity, CustomerEntity) -> Unit = { _, _ -> },
        onError: (String) -> Unit = {}
    ) {
        viewModelScope.launch {
            try {
                val (tx, updatedCust) = repository.withdrawAdvanceDeposit(customer, amount, payoutType, notes)
                onSuccess(tx, updatedCust)
            } catch (e: Exception) {
                onError(e.message ?: "Failed to process withdrawal")
            }
        }
    }

    fun markNotificationRead(id: String) {
        viewModelScope.launch {
            repository.markNotificationRead(id)
        }
    }

    fun deleteNotification(id: String) {
        viewModelScope.launch {
            repository.deleteNotification(id)
        }
    }

    fun clearAllData(onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            repository.clearAllData()
            onComplete()
        }
    }
}

class PigmyViewModelFactory(private val repository: PigmyRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(PigmyViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return PigmyViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
