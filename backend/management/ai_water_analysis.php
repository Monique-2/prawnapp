<?php
// water_management_action.php

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200); exit;
}

require_once '../../config.php';   // adjust path if needed

if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB connection failed']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $pond_id = (int)($body['pond_id'] ?? 0);
    if ($pond_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Valid pond_id required']);
        exit;
    }

    $action_type = trim($body['action_type'] ?? '');
    if ($action_type !== 'refill') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => "action_type must be 'refill'"]);
        exit;
    }

    $scheduled = trim($body['scheduled_timestamp'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $scheduled)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid scheduled_timestamp format. Use YYYY-MM-DD HH:MM:SS']);
        exit;
    }

    $status = trim($body['action_status'] ?? 'pending');
    $allowed = ['pending','in_progress','completed','canceled','failed'];
    if (!in_array($status, $allowed)) {
        $status = 'pending';
    }

    $sql = "INSERT INTO water_management_action
            (pond_id, action_type, scheduled_timestamp, action_status)
            VALUES (?, ?, ?, ?)";
    
    $stmt = mysqli_prepare($conn, $sql);
    mysqli_stmt_bind_param($stmt, 'isss', $pond_id, $action_type, $scheduled, $status);

    if (mysqli_stmt_execute($stmt)) {
        $new_id = mysqli_insert_id($conn);
        echo json_encode([
            'success' => true,
            'message' => 'Refill scheduled',
            'wm_id'   => $new_id
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . mysqli_error($conn)
        ]);
    }

    mysqli_stmt_close($stmt);
    exit;
}

// ← add GET, PUT, etc. later if needed

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);