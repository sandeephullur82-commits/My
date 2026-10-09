package com.pigmypro.smartcollection

import com.pigmypro.smartcollection.data.entity.CustomerEntity
import com.pigmypro.smartcollection.data.model.OverdueResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class CalculationUnitTest {

    private fun calculateOverdue(customer: CustomerEntity, now: Long): OverdueResult {
        if (customer.isDeleted) return OverdueResult(false, 0.0, 0.0, 0)
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

    @Test
    fun testOverdueCalculation() {
        val now = System.currentTimeMillis()
        val startDate = now - (10 * 24 * 60 * 60 * 1000L) // 10 days ago
        val endDate = now + (90 * 24 * 60 * 60 * 1000L)  // 100 days total

        val customer = CustomerEntity(
            id = "CUST-001",
            name = "John Doe",
            phone = "9876543210",
            loan = 10000.0,
            paid = 500.0, // Expected 10 * 100 = 1000, so overdue by 500
            startDate = startDate,
            endDate = endDate,
            durationDays = 100
        )

        val result = calculateOverdue(customer, now)
        assertTrue(result.isOverdue)
        assertEquals(500.0, result.amount, 0.01)
        assertEquals(5, result.daysMissing)
    }
}
