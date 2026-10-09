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
import androidx.compose.ui.platform.LocalContext
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
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun EntryScreen(
    viewModel: PigmyViewModel,
    initialTab: String? = "PENDING"
) {
    val context = LocalContext.current
    val customers by viewModel.customers.collectAsState()
    val transactions by viewModel.transactions.collectAsState()

    var activeTab by remember { mutableStateOf(initialTab ?: "PENDING") } // PENDING, PAID, ALL
    var searchQuery by remember { mutableStateOf("") }

    val todayStr = remember { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()) }

    val todayPaidCustomerIds = remember(transactions, todayStr) {
        transactions
            .filter { it.date == todayStr && !it.isDeleted && it.status == "paid" }
            .map { it.customerId }
            .toSet()
    }

    val displayCustomers = remember(customers, searchQuery, activeTab, todayPaidCustomerIds) {
        customers.filter { c ->
            val matchesSearch = c.name.contains(searchQuery, ignoreCase = true) ||
                    c.id.contains(searchQuery, ignoreCase = true) ||
                    c.phone.contains(searchQuery)

            val isPaidToday = todayPaidCustomerIds.contains(c.id)

            val matchesTab = when (activeTab) {
                "PENDING" -> c.pending > 0 && !isPaidToday
                "PAID" -> isPaidToday
                else -> true
            }

            matchesSearch && matchesTab
        }
    }

    var paymentDialogCustomer by remember { mutableStateOf<CustomerEntity?>(null) }
    var successReceiptTx by remember { mutableStateOf<Pair<CustomerEntity, TransactionEntity>?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // High-Speed Entry Header & Tabs
        Text("High-Speed Entry", fontSize = 20.sp, fontWeight = FontWeight.Bold)

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf("PENDING" to "Pending Today", "PAID" to "Collected Today", "ALL" to "All Accounts").forEach { (key, label) ->
                FilterChip(
                    selected = activeTab == key,
                    onClick = { activeTab = key },
                    label = { Text(label, fontSize = 12.sp) }
                )
            }
        }

        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search account...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(displayCustomers, key = { it.id }) { customer ->
                val isPaidToday = todayPaidCustomerIds.contains(customer.id)

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(customer.name, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                Text("ID: ${customer.id} • Pending: ${Utils.formatCurrency(customer.pending)}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }

                            if (isPaidToday) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(SuccessGreen.copy(alpha = 0.15f))
                                        .padding(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Text("COLLECTED", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                                }
                            }
                        }

                        // Quick Collection Action Buttons
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = {
                                    paymentDialogCustomer = customer
                                },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                            ) {
                                Icon(Icons.Default.Payments, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Record", fontSize = 12.sp)
                            }

                            Button(
                                onClick = {
                                    Utils.triggerVibration(context)
                                    val dailyInstallment = (customer.loanAmount / customer.durationDays).toInt().toDouble()
                                    val amount = if (dailyInstallment > 0) dailyInstallment else 100.0
                                    val tx = TransactionEntity(
                                        id = UUID.randomUUID().toString(),
                                        customerId = customer.id,
                                        amount = amount,
                                        type = "cash",
                                        status = "paid",
                                        date = todayStr,
                                        timestamp = System.currentTimeMillis()
                                    )
                                    viewModel.saveTransaction(tx, customer) {
                                        successReceiptTx = Pair(customer, tx)
                                    }
                                },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen)
                            ) {
                                Text("Quick Cash", fontSize = 12.sp)
                            }

                            OutlinedButton(
                                onClick = {
                                    Utils.triggerVibration(context)
                                    val tx = TransactionEntity(
                                        id = UUID.randomUUID().toString(),
                                        customerId = customer.id,
                                        amount = 0.0,
                                        type = "NP",
                                        status = "unsettled",
                                        date = todayStr,
                                        timestamp = System.currentTimeMillis()
                                    )
                                    viewModel.saveTransaction(tx, customer)
                                },
                                modifier = Modifier.weight(0.8f),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRose)
                            ) {
                                Text("NP", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }

    // Payment Dialog
    paymentDialogCustomer?.let { customer ->
        QuickPaymentModal(
            customer = customer,
            onDismiss = { paymentDialogCustomer = null },
            onConfirm = { amount, mode ->
                Utils.triggerVibration(context)
                val tx = TransactionEntity(
                    id = UUID.randomUUID().toString(),
                    customerId = customer.id,
                    amount = amount,
                    type = mode,
                    status = "paid",
                    date = todayStr,
                    timestamp = System.currentTimeMillis()
                )
                viewModel.saveTransaction(tx, customer) {
                    paymentDialogCustomer = null
                    successReceiptTx = Pair(customer, tx)
                }
            }
        )
    }

    // Success Receipt Modal
    successReceiptTx?.let { (customer, tx) ->
        AlertDialog(
            onDismissRequest = { successReceiptTx = null },
            title = { Text("Collection Recorded!") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Customer: ${customer.name}")
                    Text("Amount: ${Utils.formatCurrency(tx.amount)} (${tx.type.uppercase()})", fontWeight = FontWeight.Bold, color = SuccessGreen)
                    Text("Remaining Debt: ${Utils.formatCurrency(customer.pending)}")
                    if (customer.advanceBalance > 0) {
                        Text("Advance Deposit: ${Utils.formatCurrency(customer.advanceBalance)}", color = SuccessGreen, fontWeight = FontWeight.Bold)
                    }
                }
            },
            confirmButton = {
                Button(onClick = {
                    Utils.shareWhatsAppReceipt(context, customer, tx)
                    successReceiptTx = null
                }) {
                    Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("WhatsApp Receipt")
                }
            },
            dismissButton = {
                TextButton(onClick = { successReceiptTx = null }) {
                    Text("Done")
                }
            }
        )
    }
}

@Composable
fun QuickPaymentModal(
    customer: CustomerEntity,
    onDismiss: () -> Unit,
    onConfirm: (Double, String) -> Unit
) {
    val dailyInstallment = (customer.loanAmount / customer.durationDays).toInt().toDouble()
    var amountInput by remember { mutableStateOf((if (dailyInstallment > 0) dailyInstallment else 100.0).toInt().toString()) }
    var selectedMode by remember { mutableStateOf("cash") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Record Payment") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Customer: ${customer.name}", fontWeight = FontWeight.Bold)

                OutlinedTextField(
                    value = amountInput,
                    onValueChange = { amountInput = it },
                    label = { Text("Collection Amount (₹)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = selectedMode == "cash",
                        onClick = { selectedMode = "cash" },
                        label = { Text("Cash") }
                    )
                    FilterChip(
                        selected = selectedMode == "phonepe",
                        onClick = { selectedMode = "phonepe" },
                        label = { Text("PhonePe UPI") }
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val amt = amountInput.toDoubleOrNull() ?: 0.0
                if (amt > 0) {
                    onConfirm(amt, selectedMode)
                }
            }) {
                Text("Submit")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
