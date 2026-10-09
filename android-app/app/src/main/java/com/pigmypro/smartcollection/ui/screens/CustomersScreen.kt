package com.pigmypro.smartcollection.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.PushPin
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
import com.pigmypro.smartcollection.data.model.ConvertersHelper
import com.pigmypro.smartcollection.data.model.RenewalData
import com.pigmypro.smartcollection.ui.theme.ErrorRose
import com.pigmypro.smartcollection.ui.theme.PrimaryBlue
import com.pigmypro.smartcollection.ui.theme.SuccessGreen
import com.pigmypro.smartcollection.ui.theme.WarningAmber
import com.pigmypro.smartcollection.ui.viewmodel.PigmyViewModel

@Composable
fun CustomersScreen(
    viewModel: PigmyViewModel,
    initialFilter: String? = null
) {
    val customers by viewModel.customers.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var activeTab by remember { mutableStateOf(initialFilter ?: "ALL") } // ALL, OVERDUE, COMPLETED, PINNED

    var selectedCustomerForDetails by remember { mutableStateOf<CustomerEntity?>(null) }
    var showAddCustomerDialog by remember { mutableStateOf(false) }

    val filteredCustomers = remember(customers, searchQuery, activeTab) {
        customers.filter { c ->
            val matchesSearch = c.name.contains(searchQuery, ignoreCase = true) ||
                    c.id.contains(searchQuery, ignoreCase = true) ||
                    c.phone.contains(searchQuery)

            val overdueRes = viewModel.calculateOverdue(c)

            val matchesTab = when (activeTab) {
                "OVERDUE" -> overdueRes.isOverdue && c.pending > 0
                "COMPLETED" -> c.pending <= 0
                "PINNED" -> c.isPinned
                else -> true
            }

            matchesSearch && matchesTab
        }
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddCustomerDialog = true },
                containerColor = PrimaryBlue,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Customer")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search by name, ID, or phone...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Clear, contentDescription = null)
                        }
                    }
                },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            // Filter Tabs
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("ALL" to "All", "OVERDUE" to "Overdue", "COMPLETED" to "Completed", "PINNED" to "Pinned").forEach { (key, label) ->
                    FilterChip(
                        selected = activeTab == key,
                        onClick = { activeTab = key },
                        label = { Text(label, fontSize = 12.sp) }
                    )
                }
            }

            // Customer List
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredCustomers, key = { it.id }) { customer ->
                    CustomerCardItem(
                        customer = customer,
                        viewModel = viewModel,
                        onClick = { selectedCustomerForDetails = customer }
                    )
                }
            }
        }
    }

    // Customer Details Dialog / Modal
    selectedCustomerForDetails?.let { customer ->
        CustomerDetailsModal(
            customer = customer,
            viewModel = viewModel,
            onDismiss = { selectedCustomerForDetails = null }
        )
    }

    // Add / Edit Customer Dialog
    if (showAddCustomerDialog) {
        CustomerFormDialog(
            viewModel = viewModel,
            onDismiss = { showAddCustomerDialog = false }
        )
    }
}

@Composable
fun CustomerCardItem(
    customer: CustomerEntity,
    viewModel: PigmyViewModel,
    onClick: () -> Unit
) {
    val overdueRes = remember(customer) { viewModel.calculateOverdue(customer) }
    val isCompleted = customer.pending <= 0

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
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
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = customer.name,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "(${customer.id})",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                IconButton(onClick = { viewModel.togglePin(customer.id, customer.isPinned) }) {
                    Icon(
                        imageVector = if (customer.isPinned) Icons.Default.PushPin else Icons.Outlined.PushPin,
                        contentDescription = "Pin",
                        tint = if (customer.isPinned) WarningAmber else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Loan Progress
            val progress = remember(customer) {
                if (customer.loanAmount == 0.0) 0f else (customer.paid / customer.loanAmount).toFloat().coerceIn(0f, 1f)
            }

            LinearProgressIndicator(
                progress = progress,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = if (isCompleted) SuccessGreen else PrimaryBlue,
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Total Loan", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(Utils.formatCurrency(customer.loanAmount), fontWeight = FontWeight.Bold)
                }
                Column {
                    Text("Paid", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(Utils.formatCurrency(customer.paid), fontWeight = FontWeight.Bold, color = SuccessGreen)
                }
                Column {
                    Text("Pending", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        Utils.formatCurrency(customer.pending),
                        fontWeight = FontWeight.Bold,
                        color = if (isCompleted) SuccessGreen else ErrorRose
                    )
                }
            }

            if (customer.advanceBalance > 0) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(SuccessGreen.copy(alpha = 0.1f))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Advance Savings Deposit:", fontSize = 12.sp, color = SuccessGreen, fontWeight = FontWeight.Bold)
                    Text(Utils.formatCurrency(customer.advanceBalance), fontSize = 12.sp, color = SuccessGreen, fontWeight = FontWeight.Black)
                }
            }

            if (overdueRes.isOverdue && customer.pending > 0) {
                Text(
                    text = "⚠️ Overdue by ${Utils.formatCurrency(overdueRes.amount)} (${overdueRes.daysMissing} days)",
                    fontSize = 11.sp,
                    color = ErrorRose,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun CustomerFormDialog(
    viewModel: PigmyViewModel,
    customerToEdit: CustomerEntity? = null,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf(customerToEdit?.name ?: "") }
    var phone by remember { mutableStateOf(customerToEdit?.phone ?: "") }
    var loanAmount by remember { mutableStateOf(customerToEdit?.loanAmount?.toInt()?.toString() ?: "10000") }
    var durationDays by remember { mutableStateOf(customerToEdit?.durationDays?.toString() ?: "100") }
    var generatedId by remember { mutableStateOf(customerToEdit?.id ?: "") }

    LaunchedEffect(customerToEdit) {
        if (customerToEdit == null) {
            generatedId = viewModel.getNextCustomerId()
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (customerToEdit == null) "New Customer" else "Edit Customer") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Assigned ID: $generatedId", fontWeight = FontWeight.Bold, color = PrimaryBlue)

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Customer Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("Phone Number") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = loanAmount,
                    onValueChange = { loanAmount = it },
                    label = { Text("Loan Amount (₹)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = durationDays,
                    onValueChange = { durationDays = it },
                    label = { Text("Term Duration (Days)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(onClick = {
                val loan = loanAmount.toDoubleOrNull() ?: 10000.0
                val duration = durationDays.toIntOrNull() ?: 100
                val now = System.currentTimeMillis()
                val endDate = now + (duration * 24 * 60 * 60 * 1000L)

                val entity = CustomerEntity(
                    id = generatedId,
                    name = name,
                    phone = phone,
                    loan = loan,
                    loanAmount = loan,
                    totalLoan = loan,
                    paid = customerToEdit?.paid ?: 0.0,
                    pending = if (customerToEdit != null) customerToEdit.pending else loan,
                    startDate = customerToEdit?.startDate ?: now,
                    endDate = customerToEdit?.endDate ?: endDate,
                    durationDays = duration
                )

                viewModel.saveCustomer(entity) {
                    onDismiss()
                }
            }) {
                Text("Save Customer")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun CustomerDetailsModal(
    customer: CustomerEntity,
    viewModel: PigmyViewModel,
    onDismiss: () -> Unit
) {
    val cycles = remember(customer) { ConvertersHelper.jsonToCycles(customer.cyclesJson) }
    var showWithdrawDialog by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Text(customer.name, fontWeight = FontWeight.Bold)
                Text("ID: ${customer.id} • ${customer.phone}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Loan Amount:")
                            Text(Utils.formatCurrency(customer.loanAmount), fontWeight = FontWeight.Bold)
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Total Paid:")
                            Text(Utils.formatCurrency(customer.paid), fontWeight = FontWeight.Bold, color = SuccessGreen)
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Pending Debt:")
                            Text(Utils.formatCurrency(customer.pending), fontWeight = FontWeight.Bold, color = ErrorRose)
                        }
                        if (customer.advanceBalance > 0) {
                            Divider()
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Advance Savings:", fontWeight = FontWeight.Bold, color = SuccessGreen)
                                Text(Utils.formatCurrency(customer.advanceBalance), fontWeight = FontWeight.Black, color = SuccessGreen)
                            }
                        }
                    }
                }

                if (customer.advanceBalance > 0) {
                    Button(
                        onClick = { showWithdrawDialog = true },
                        colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Withdraw Advance Savings Deposit")
                    }
                }

                if (cycles.isNotEmpty()) {
                    Text("Loan Cycle History (${cycles.size})", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    cycles.forEach { cycle ->
                        Text(
                            "• Cycle #${cycle.cycleNumber}: Amt ₹${cycle.loanAmount.toInt()} | Status: ${cycle.status}",
                            fontSize = 11.sp
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Close") }
        }
    )

    if (showWithdrawDialog) {
        WithdrawAdvanceDialog(
            customer = customer,
            viewModel = viewModel,
            onDismiss = { showWithdrawDialog = false }
        )
    }
}

@Composable
fun WithdrawAdvanceDialog(
    customer: CustomerEntity,
    viewModel: PigmyViewModel,
    onDismiss: () -> Unit
) {
    var amountInput by remember { mutableStateOf("") }
    var payoutType by remember { mutableStateOf("cash") }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Withdraw Advance Savings Deposit") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Available Balance: ${Utils.formatCurrency(customer.advanceBalance)}", fontWeight = FontWeight.Bold, color = SuccessGreen)

                OutlinedTextField(
                    value = amountInput,
                    onValueChange = { amountInput = it; errorMessage = null },
                    label = { Text("Withdrawal Amount (₹)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = payoutType == "cash",
                        onClick = { payoutType = "cash" },
                        label = { Text("Cash Payout") }
                    )
                    FilterChip(
                        selected = payoutType == "phonepe",
                        onClick = { payoutType = "phonepe" },
                        label = { Text("PhonePe UPI") }
                    )
                }

                errorMessage?.let {
                    Text(it, color = ErrorRose, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val amt = amountInput.toDoubleOrNull() ?: 0.0
                viewModel.withdrawAdvanceDeposit(
                    customer = customer,
                    amount = amt,
                    payoutType = payoutType,
                    notes = null,
                    onSuccess = { _, _ -> onDismiss() },
                    onError = { errorMessage = it }
                )
            }) {
                Text("Confirm Payout")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
