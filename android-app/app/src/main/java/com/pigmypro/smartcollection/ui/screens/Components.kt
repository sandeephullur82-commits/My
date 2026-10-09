package com.pigmypro.smartcollection.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
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
import com.pigmypro.smartcollection.ui.theme.SuccessGreen
import com.pigmypro.smartcollection.ui.theme.WarningAmber
import java.text.SimpleDateFormat
import java.util.*

object Utils {
    fun formatCurrency(amount: Double): String {
        return "₹${amount.toInt()}"
    }

    fun formatDate(timestamp: Long): String {
        val sdf = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
        return sdf.format(Date(timestamp))
    }

    fun triggerVibration(context: Context) {
        try {
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            if (vibrator != null && vibrator.hasVibrator()) {
                vibrator.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE))
            }
        } catch (e: Exception) {
            // Ignore if vibration unavailable
        }
    }

    fun shareWhatsAppReceipt(context: Context, customer: CustomerEntity, tx: TransactionEntity) {
        val message = """
            🧾 *PIGMY PRO COLLECTION RECEIPT*
            --------------------------------
            Customer: ${customer.name} (${customer.id})
            Amount Paid: ₹${tx.amount.toInt()}
            Mode: ${tx.type.uppercase()}
            Date: ${tx.date}
            Remaining Loan Balance: ₹${customer.pending.toInt()}
            Advance Savings Balance: ₹${customer.advanceBalance.toInt()}
            --------------------------------
            Thank you for your timely payment!
        """.trimIndent()

        val intent = Intent(Intent.ACTION_VIEW).apply {
            val phone = if (customer.phone.startsWith("91")) customer.phone else "91${customer.phone}"
            data = Uri.parse("https://api.whatsapp.com/send?phone=$phone&text=${Uri.encode(message)}")
        }
        try {
            context.startActivity(intent)
        } catch (e: Exception) {
            // WhatsApp not installed, fallback to share sheet
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, message)
            }
            context.startActivity(Intent.createChooser(shareIntent, "Share Receipt"))
        }
    }

    fun printThermalReceipt(context: Context, customer: CustomerEntity, tx: TransactionEntity): String {
        return """
            ==============================
                 PIGMY PRO FINTECH
                 COLLECTION RECEIPT
            ==============================
            Date: ${tx.date}
            Tx ID: ${tx.id.take(8)}
            Cust ID: ${customer.id}
            Name: ${customer.name}
            Phone: ${customer.phone}
            ------------------------------
            Collection Amt:  ₹${tx.amount.toInt()}
            Payment Mode:    ${tx.type.uppercase()}
            ------------------------------
            Loan Balance:    ₹${customer.pending.toInt()}
            Advance Deposit: ₹${customer.advanceBalance.toInt()}
            ==============================
            Thank you for prompt payment!
            ==============================
        """.trimIndent()
    }
}

@Composable
fun SyncStatusHeader(lastSyncedTime: String = "Just Now", online: Boolean = true) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(if (online) SuccessGreen else WarningAmber)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (online) "Sync Active" else "Offline Mode",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
            Text(
                text = "Last sync: $lastSyncedTime",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
