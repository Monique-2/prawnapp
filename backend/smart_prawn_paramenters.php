<?php
header("Content-Type: application/json");
include "config.php";

// Enable error reporting for debugging (remove in production)
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Function to send JSON response
function sendResponse($success, $data = [], $message = "") {
    echo json_encode([
        "success" => $success,
        "data" => $data,
        "message" => $message
    ], JSON_PRETTY_PRINT);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $pond_name_string = $_POST['pond_name'] ?? '';
    $temperature = $_POST['temperature'] ?? null;
    $pH = $_POST['pH'] ?? null;
    $salinity = $_POST['salinity'] ?? null;
    $ammonia = $_POST['ammonia'] ?? null;

    if (!$pond_name_string) {
        sendResponse(false, [], "pond_name is required");
    }

    $stmt = $conn->prepare("SELECT id FROM ponds WHERE pond_name = ?");
    if (!$stmt) {
        sendResponse(false, [], "Database error: " . $conn->error);
    }
    $stmt->bind_param("s", $pond_name_string);
    $stmt->execute();
    $result = $stmt->get_result();
    $pond = $result->fetch_assoc();

    if (!$pond) {
        sendResponse(false, [], "Invalid pond_name");
    }

    $pond_name = $pond['id'];

    // Insert water quality data
    $sql = "INSERT INTO water_quality_parameters 
            (pond_name, temperature, pH, salinity, ammonia) 
            VALUES (?, ?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        sendResponse(false, [], "Database error: " . $conn->error);
    }
    $stmt->bind_param("iddddd", $pond_name, $temperature, $pH, $salinity, $ammonia);

    if ($stmt->execute()) {
        sendResponse(true, [], "Water quality data added");
    } else {
        sendResponse(false, [], "Insert failed: " . $stmt->error);
    }

    $stmt->close();
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $pond_name_string = $_GET['pond_name'] ?? '';

    try {
        if ($pond_name_string) {
            $stmt = $conn->prepare("
                SELECT wqp.*, p.pond_name AS pond_code
                FROM water_quality_parameters wqp
                JOIN ponds p ON wqp.pond_id = p.id
                WHERE p.pond_name = ?
                ORDER BY wqp.updated_at DESC
            ");
            if (!$stmt) {
                sendResponse(false, [], "Database error: " . $conn->error);
            }
            $stmt->bind_param("s", $pond_name_string);
        } else {
            $stmt = $conn->prepare("
                SELECT wqp.*, p.pond_name AS pond_code
                FROM water_quality_parameters wqp
                JOIN ponds p ON wqp.pond_id = p.id
                ORDER BY wqp.updated_at DESC
            ");
            if (!$stmt) {
                sendResponse(false, [], "Database error: " . $conn->error);
            }
        }

        $stmt->execute();
        $result = $stmt->get_result();

        $data = [];
        while ($row = $result->fetch_assoc()) {
            $data[] = $row;
        }

        sendResponse(true, $data);
    } catch (Exception $e) {
        sendResponse(false, [], "Server error: " . $e->getMessage());
    } finally {
        if (isset($stmt)) {
            $stmt->close();
        }
    }
} else {
    sendResponse(false, [], "Invalid request method");
}

$conn->close();
?>