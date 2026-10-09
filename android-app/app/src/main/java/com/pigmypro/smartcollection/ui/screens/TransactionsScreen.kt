package com.pigmypro.smartcollection.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pigmypro.smartcollection.data.entity.CustomerEntity
import com.pigmypro.smartcollection.data.entity.TransactionEntity
import com.pigmypro.smartcollection.ui.theme.ErrorRose
import com.pigmypro.smartcollection.ui.theme.PrimaryBlue
import com.pigmypro.smartcollection.ui.theme.SuccessGreen
import com.pigmypro.smartcollection.ui.theme.WarningAmber
import com.pigmypro.smartcollection.ui.viewmodel.PigmyViewModel

@Composable
fun TransactionsScreen(
    viewModel: PigmyViewModel,
    initialFilter: String? = null
) {
    val transactions by viewModel.transactions.collectAsState()
    val customers by viewModel.customers.collectAsState()

    var activeFilter by remember { mutableStateOf(initialFilter ?: "ALL") } // ALL, CASH, PHONEPE, UNSETTLED, WITHDRAWALS
    var searchQuery by remember { mutableStateOf("") }

    val customerMap = remember(customers) { customers.associateBy { it.id } }

    val filteredTransactions = remember(transactions, searchQuery, activeFilter, customerMap) {
        transactions.filter { tx ->
            val customer = customerMap[tx.customerId]
            val custName = customer?.name ?: ""
            val matchesSearch = custName.contains(searchQuery, ignoreCase = true) ||
                    tx.customerId.contains(searchQuery, ignoreCase = true) ||
                    tx.id.contains(searchQuery, ignoreCase = true)

            val matchesFilter = when (activeFilter) {
                "CASH" -> tx.type == "cash" && tx.status == "paid"
                "PHONEPE" -> tx.type == "phonepe" && tx.status == "paid"
                "UNSETTLED" -> tx.status == "unsettled" || tx.type == "NP"
                "WITHDRAWALS" -> tx.isWithdrawal
                else -> true
            }

            matchesSearch && matchesFilter
        }
    }

    var editingTransaction by remember { mutableStateOf<TransactionEntity?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Transaction Ledger & Audit", fontSize = 20.sp, fontWeight = FontWeight.Bold)

        // Filter Chips
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            listOf("ALL" to "All", "CASH" to "Cash", "PHONEPE" to "PhonePe", "UNSETTLED" to "NP", "WITHDRAWALS" to "Payouts").forEach { (key, label) ->
                FilterChip(
                    selected = activeFilter == key,
                    onClick = { activeFilter = key },
                    label = { Text(label, fontSize = 11.sp) }
                )
            }
        }

        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search ledger by customer, ID...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(filteredTransactions, key = { it.id }) { tx ->
                val customer = customerMap[tx.customerId]

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = customer?.name ?: "Unknown (${tx.customerId})",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp
                            )
                            Text(
                                text = "${tx.date} • ${tx.type.uppercase()} • Status: ${tx.status}",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            if (tx.isWithdrawal) {
                                Text("Advance Savings Payout", fontSize = 11.sp, color = WarningAmber, fontWeight = FontWeight.Bold)
                            }
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = Utils.formatCurrency(tx.amount),
                                fontWeight = FontWeight.Black,
                                fontSize = 16.sp,
                                color = if (tx.isWithdrawal) WarningAmber else (if (tx.type == "NP") ErrorRose else SuccessGreen)
                            )

                            IconButton(onClick = { editingTransaction = tx }) {
                                Icon(Icons.Default.Edit, contentDescription = "Edit", modifier = Modifier.size(18.dp))
                            }

                            IconButton(onClick = {
                                customer?.let { c -> viewModel.deleteTransaction(tx, c) }
                            }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete", modifier = Modifier.size(18.dp), tint = ErrorRose)
                            }
                        }
                    }
                }
            }
        }
    }

    editingTransaction?.let { tx ->
        val customer = customerMap[tx.customerId]
        if (customer != null) {
            EditTransactionModal(
                tx = tx,
                customer = customer,
                viewModel = viewModel,
                onDismiss = { editingTransaction = null }
            )
        }
    }
}

@Composable
fun EditTransactionModal(
    tx: TransactionEntity,
    customer: CustomerEntity,
    viewModel: PigmyViewModel,
    onDismiss: () -> Unit
) {
    var amountInput by remember { mutableStateOf(tx.amount.toInt().toString()) }
    var selectedType by remember { mutableStateOf(tx.type) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Entry (${tx.id.take(8)})") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Customer: ${customer.name}", fontWeight = FontWeight.Bold)

                OutlinedTextField(
                    value = amountInput,
                    onValueChange = { amountInput = it },
                    label = { Text("Amount (₹)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = selectedType == "cash",
                        onClick = { selectedType = "cash" },
                        label = { Text("Cash") }
                    )
                    FilterChip(
                        selected = selectedType == "phonepe",
                        onClick = { selectedType = "phonepe" },
                        label = { Text("PhonePe") }
                    )
                    FilterChip(
                        selected = selectedType == "NP",
                        onClick = { selectedType = "NP" },
                        label = { Text("NP") }
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val amt = amountInput.toDoubleOrNull() ?: tx.amount
                val updates = tx.copy(amount = amt, type = selectedType)
                viewModel.updateTransaction(
                    txId = tx.id,
                    updates = updates,
                    oldTx = tx,
                    customer = customer,
                    actionName = "Manual Adjustment"
                ) {
                    onDismiss()
                }
            }) {
                Text("Save Changes")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
