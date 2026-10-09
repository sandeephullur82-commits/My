package com.pigmypro.smartcollection

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.pigmypro.smartcollection.data.db.PigmyDatabase
import com.pigmypro.smartcollection.data.repository.PigmyRepository
import com.pigmypro.smartcollection.ui.screens.*
import com.pigmypro.smartcollection.ui.theme.PigmyProTheme
import com.pigmypro.smartcollection.ui.viewmodel.PigmyViewModel
import com.pigmypro.smartcollection.ui.viewmodel.PigmyViewModelFactory

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Dashboard : Screen("dashboard", "Dashboard", Icons.Default.Dashboard)
    object Customers : Screen("customers", "Customers", Icons.Default.Group)
    object Entry : Screen("entry", "Entry", Icons.Default.Payments)
    object Transactions : Screen("transactions", "Ledger", Icons.Default.ReceiptLong)
    object Notifications : Screen("notifications", "Alerts", Icons.Default.Notifications)
    object Settings : Screen("settings", "Settings", Icons.Default.Settings)
}

class MainActivity : ComponentActivity() {

    private val viewModel: PigmyViewModel by viewModels {
        val db = PigmyDatabase.getDatabase(applicationContext)
        val repository = PigmyRepository(
            db.customerDao(),
            db.transactionDao(),
            db.notificationDao()
        )
        PigmyViewModelFactory(repository)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            var isDarkMode by remember { mutableStateOf(true) }

            PigmyProTheme(darkTheme = isDarkMode) {
                val navController = rememberNavController()
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = navBackStackEntry?.destination?.route ?: Screen.Dashboard.route

                val items = listOf(
                    Screen.Dashboard,
                    Screen.Customers,
                    Screen.Entry,
                    Screen.Transactions,
                    Screen.Notifications,
                    Screen.Settings
                )

                Scaffold(
                    bottomBar = {
                        NavigationBar {
                            items.forEach { screen ->
                                NavigationBarItem(
                                    icon = { Icon(screen.icon, contentDescription = screen.title) },
                                    label = { Text(screen.title) },
                                    selected = currentRoute.startsWith(screen.route),
                                    onClick = {
                                        navController.navigate(screen.route) {
                                            popUpTo(navController.graph.findStartDestination().id) {
                                                saveState = true
                                            }
                                            launchSingleTop = true
                                            restoreState = true
                                        }
                                    }
                                )
                            }
                        }
                    }
                ) { innerPadding ->
                    NavHost(
                        navController = navController,
                        startDestination = Screen.Dashboard.route,
                        modifier = Modifier.padding(innerPadding)
                    ) {
                        composable(Screen.Dashboard.route) {
                            DashboardScreen(
                                viewModel = viewModel,
                                onNavigate = { target, filter ->
                                    val route = if (filter != null) "$target?filter=$filter" else target
                                    navController.navigate(route)
                                }
                            )
                        }

                        composable("customers?filter={filter}") { backStackEntry ->
                            val filter = backStackEntry.arguments?.getString("filter")
                            CustomersScreen(
                                viewModel = viewModel,
                                initialFilter = filter
                            )
                        }

                        composable(Screen.Customers.route) {
                            CustomersScreen(viewModel = viewModel)
                        }

                        composable("entry?filter={filter}") { backStackEntry ->
                            val filter = backStackEntry.arguments?.getString("filter")
                            EntryScreen(
                                viewModel = viewModel,
                                initialTab = filter
                            )
                        }

                        composable(Screen.Entry.route) {
                            EntryScreen(viewModel = viewModel)
                        }

                        composable("transactions?filter={filter}") { backStackEntry ->
                            val filter = backStackEntry.arguments?.getString("filter")
                            TransactionsScreen(
                                viewModel = viewModel,
                                initialFilter = filter
                            )
                        }

                        composable(Screen.Transactions.route) {
                            TransactionsScreen(viewModel = viewModel)
                        }

                        composable(Screen.Notifications.route) {
                            NotificationsScreen(viewModel = viewModel)
                        }

                        composable(Screen.Settings.route) {
                            SettingsScreen(
                                viewModel = viewModel,
                                isDarkMode = isDarkMode,
                                onToggleDarkMode = { isDarkMode = it }
                            )
                        }
                    }
                }
            }
        }
    }
}
