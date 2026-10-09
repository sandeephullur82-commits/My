package com.pigmypro.smartcollection.ui.screens

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.Gson
import com.pigmypro.smartcollection.data.entity.CustomerEntity
import com.pigmypro.smartcollection.data.entity.TransactionEntity
import com.pigmypro.smartcollection.ui.theme.ErrorRose
import com.pigmypro.smartcollection.ui.theme.PrimaryBlue
import com.pigmypro.smartcollection.ui.theme.SuccessGreen
import com.pigmypro.smartcollection.ui.viewmodel.PigmyViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class BackupData(
    val customers: List<CustomerEntity>,
    val transactions: List<TransactionEntity>
)

@Composable
fun SettingsScreen(
    viewModel: PigmyViewModel,
    isDarkMode: Boolean,
    onToggleDarkMode: (Boolean) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val customers by viewModel.customers.collectAsState()
    val transactions by viewModel.transactions.collectAsState()

    var showClearConfirmDialog by remember { mutableStateOf(false) }

    // Export Backup File Launcher
    val exportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/json")
    ) { uri: Uri? ->
        uri?.let { destUri ->
            coroutineScope.launch(Dispatchers.IO) {
                try {
                    val backup = BackupData(customers, transactions)
                    val json = Gson().toJson(backup)
                    context.contentResolver.openOutputStream(destUri)?.use { stream ->
                        stream.write(json.toByteArray())
                    }
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "Backup exported successfully!", Toast.LENGTH_LONG).show()
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "Export failed: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    // Import Backup File Launcher
    val importLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { srcUri ->
            coroutineScope.launch(Dispatchers.IO) {
                try {
                    val json = context.contentResolver.openInputStream(srcUri)?.bufferedReader()?.use { it.readText() }
                    if (!json.isNullOrEmpty()) {
                        val backup = Gson().fromJson(json, BackupData::class.java)
                        if (backup?.customers != null) {
                            backup.customers.forEach { viewModel.saveCustomer(it) }
                        }
                        if (backup?.transactions != null) {
                            backup.transactions.forEach { tx ->
                                val cust = backup.customers?.find { it.id == tx.customerId }
                                if (cust != null) viewModel.saveTransaction(tx, cust)
                            }
                        }
                        withContext(Dispatchers.Main) {
                            Toast.makeText(context, "Backup restored successfully!", Toast.LENGTH_LONG).show()
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "Import failed: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text("Settings & System Backup", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }

        // Appearance Section
        item {
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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = if (isDarkMode) Icons.Default.DarkMode else Icons.Default.LightMode,
                            contentDescription = null,
                            tint = PrimaryBlue
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text("Dark Theme", fontWeight = FontWeight.Bold)
                            Text("Toggle light / dark app appearance", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    Switch(
                        checked = isDarkMode,
                        onCheckedChange = onToggleDarkMode
                    )
                }
            }
        }

        // Data Export & Backup Section
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("DATA BACKUP & RESTORE", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)

                    Button(
                        onClick = { exportLauncher.launch("pigmy_pro_backup_${System.currentTimeMillis()}.json") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Export JSON Data Backup")
                    }

                    OutlinedButton(
                        onClick = { importLauncher.launch("application/json") },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Upload, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Restore JSON Data Backup")
                    }
                }
            }
        }

        // Clear Database Section
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = ErrorRose.copy(alpha = 0.08f)),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("DANGER ZONE", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = ErrorRose)
                    Text(
                        "Clearing local storage deletes all offline accounts, daily entries, and notifications.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Button(
                        onClick = { showClearConfirmDialog = true },
                        colors = ButtonDefaults.buttonColors(containerColor = ErrorRose),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.DeleteForever, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Clear All Local Data")
                    }
                }
            }
        }

        // App Information
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Pigmy Pro – Smart Collection System", fontWeight = FontWeight.Bold)
                    Text("Version 1.0.0 (Native Android Build)", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Package: com.pigmypro.smartcollection", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }

    if (showClearConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showClearConfirmDialog = false },
            title = { Text("Clear All Local Storage?") },
            text = { Text("Are you sure you want to permanently delete all local customers, transactions, and audit records?") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.clearAllData {
                            showClearConfirmDialog = false
                            Toast.makeText(context, "All data cleared.", Toast.LENGTH_SHORT).show()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ErrorRose)
                ) {
                    Text("Yes, Clear Everything")
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearConfirmDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
