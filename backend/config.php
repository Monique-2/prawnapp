<?php
$servername = "localhost";
$username   = "thesis";
$password   = "@Thesisabc123";
$dbname     = "thesis";

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


//
<?php
$servername = "localhost";
$username   = "thesis";
$password   = "@Thesisabc123";
$dbname     = "thesis";


// --- Configure PHP error handling ---
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't output errors in response
ini_set('log_errors', 1);

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "Connected successfully";
?>


<!-- 
<?php
$servername = "localhost";
$username   = "thesis";
$password   = "@Thesisabc123";
$dbname     = "thesis";


// --- Configure PHP error handling ---
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't output errors in response
ini_set('log_errors', 1);

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "Connected successfully";
?>


 -->
