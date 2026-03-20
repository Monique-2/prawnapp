<?php
$servername = "localhost";
$username   = "root";        // default for XAMPP
$password   = "";            // default for XAMPP
$dbname     = "prawnapp";     // updated database name

// --- Configure PHP error handling ---
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't output errors in response
ini_set('log_errors', 1);

// --- Connect to MySQL ---
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    // Always return clean JSON
    header("Content-Type: application/json");
    echo json_encode([
        "success" => false,
        "message" => "Database connection failed"
    ]);
    // Log the detailed error privately
    error_log("DB connection error: " . $conn->connect_error);
    exit;
}

// Ensure MySQL uses UTF-8
$conn->set_charset("utf8mb4");
?>
