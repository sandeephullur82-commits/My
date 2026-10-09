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
import com.pigmypro.smartcollection.data.model.MaturedRenewalData
import com.pigmypro.smartcollection.ui.theme.ErrorRose
import com.pigmypro.smartcollection.ui.theme.PrimaryBlue
import com.pigmypro.smartcollection.ui.theme.SuccessGreen
import com.pigmypro.smartcollection.ui.theme.WarningAmber
import com.pigmypro.smartcollection.ui.viewmodel.PigmyViewModel
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun DashboardScreen(
    viewModel: PigmyViewModel,
    onNavigate: (String, String?) -> Unit
) {
    val customers by viewModel.customers.collectAsState()
    val transactions by viewModel.transactions.collectAsState()

    val todayStr = remember { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()) }

    val paidTodayCustomerIds = remember(transactions, todayStr) {
        transactions
            .filter { it.date == todayStr && !it.isDeleted && it.status == "paid" }
            .map { it.customerId }
            .toSet()
    }

    val pendingCustomersCount = remember(customers, paidTodayCustomerIds) {
        customers.count { c ->
            c.pending > 0 && !paidTodayCustomerIds.contains(c.id)
        }
    }

    val todayEntriesCount = remember(transactions, todayStr) {
        transactions.count { it.date == todayStr && !it.isDeleted }
    }

    val stats = remember(transactions, todayStr) {
        var cash = 0.0
        var phonepe = 0.0
        var notPaid = 0.0

        transactions.forEach { tx ->
            if (tx.isDeleted) return@forEach
            if (tx.status == "unsettled" || tx.type == "NP") {
                notPaid += tx.amount
            }
            if (tx.date == todayStr && tx.status == "paid") {
                if (tx.type == "cash") cash += tx.amount
                if (tx.type == "phonepe") phonepe += tx.amount
            }
        }
        Triple(cash, phonepe, notPaid)
    }

    val maturedCustomers = remember(customers) {
        val now = System.currentTimeMillis()
        customers.filter { c ->
            c.pending > 0 && c.endDate <= now && c.renewalStatus != "rejected"
        }
    }

    var selectedRenewalCustomer by remember { mutableStateOf<CustomerEntity?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            SyncStatusHeader()
        }

        // Summary Metric Strips
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Card 1: Collected Today
                Card(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onNavigate("entry", "PAID") },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(SuccessGreen.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = SuccessGreen)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "$todayEntriesCount",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "Collected Today",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Card 2: Pending Today
                Card(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onNavigate("entry", "PENDING") },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(WarningAmber.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Schedule, contentDescription = null, tint = WarningAmber)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "$pendingCustomersCount",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                            color = WarningAmber
                        )
                        Text(
                            text = "Pending Today",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Card 3: Total Accounts
                Card(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onNavigate("customers", null) },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(PrimaryBlue.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Group, contentDescription = null, tint = PrimaryBlue)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "${customers.size}",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                            color = PrimaryBlue
                        )
                        Text(
                            text = "Total Accounts",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // Collection Breakdown
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "COLLECTION BREAKDOWN",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    TextButton(onClick = { onNavigate("transactions", "ALL") }) {
                        Text("Full Ledger", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Money, contentDescription = null, tint = SuccessGreen)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Cash Today", fontWeight = FontWeight.SemiBold)
                            }
                            Text(
                                Utils.formatCurrency(stats.first),
                                fontWeight = FontWeight.Bold,
                                color = SuccessGreen
                            )
                        }
                        Divider(color = MaterialTheme.colorScheme.surfaceVariant)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.QrCode, contentDescription = null, tint = PrimaryBlue)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("PhonePe UPI Today", fontWeight = FontWeight.SemiBold)
                            }
                            Text(
                                Utils.formatCurrency(stats.second),
                                fontWeight = FontWeight.Bold,
                                color = PrimaryBlue
                            )
                        }
                        Divider(color = MaterialTheme.colorScheme.surfaceVariant)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = ErrorRose)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Not Paid Total (NP)", fontWeight = FontWeight.SemiBold)
                            }
                            Text(
                                Utils.formatCurrency(stats.third),
                                fontWeight = FontWeight.Bold,
                                color = ErrorRose
                            )
                        }
                    }
                }
            }
        }

        // Matured Loan Renewals Section
        if (maturedCustomers.isNotEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = WarningAmber.copy(alpha = 0.1f)),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Autorenew, contentDescription = null, tint = WarningAmber)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Matured Loans Needing Renewal (${maturedCustomers.size})",
                                fontWeight = FontWeight.Bold,
                                color = WarningAmber
                            )
                        }

                        maturedCustomers.forEach { customer ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedRenewalCustomer = customer },
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(customer.name, fontWeight = FontWeight.Bold)
                                        Text(
                                            "Pending: ${Utils.formatCurrency(customer.pending)}",
                                            fontSize = 12.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    Button(
                                        onClick = { selectedRenewalCustomer = customer },
                                        colors = ButtonDefaults.buttonColors(containerColor = WarningAmber)
                                    ) {
                                        Text("Renew Loan", fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Renewal Dialog
    selectedRenewalCustomer?.let { customer ->
        MaturedRenewalDialog(
            customer = customer,
            onDismiss = { selectedRenewalCustomer = null },
            onConfirm = { renewalData ->
                viewModel.renewMaturedLoan(customer, renewalData) {
                    selectedRenewalCustomer = null
                }
            }
        )
    }
}

@Composable
fun MaturedRenewalDialog(
    customer: CustomerEntity,
    onDismiss: () -> Unit,
    onConfirm: (MaturedRenewalData) -> Unit
) {
    var interestInput by remember { mutableStateOf("0") }
    var durationInput by remember { mutableStateOf("${customer.durationDays}") }
    val pendingAmt = customer.pending
    val interestAmt = interestInput.toDoubleOrNull() ?: 0.0
    val totalNewDebt = pendingAmt + interestAmt

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Renew Matured Loan") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Customer: ${customer.name}", fontWeight = FontWeight.Bold)
                Text("Outstanding Debt: ${Utils.formatCurrency(pendingAmt)}")

                OutlinedTextField(
                    value = interestInput,
                    onValueChange = { interestInput = it },
                    label = { Text("Interest / Fine Fee (₹)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = durationInput,
                    onValueChange = { durationInput = it },
                    label = { Text("New Term Duration (Days)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            "New Restructured Debt: ${Utils.formatCurrency(totalNewDebt)}",
                            fontWeight = FontWeight.Bold,
                            color = PrimaryBlue
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val duration = durationInput.toIntOrNull() ?: 100
                val now = System.currentTimeMillis()
                val endDate = now + (duration * 24 * 60 * 60 * 1000L)

                onConfirm(
                    MaturedRenewalData(
                        interestAmount = interestAmt,
                        interestType = "flat",
                        newTotalDebt = totalNewDebt,
                        durationDays = duration,
                        startDate = now,
                        endDate = endDate
                    )
                )
            }) {
                Text("Confirm Renewal")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
