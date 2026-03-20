<?php
// backend/management/water_management_action.php
// Version without wd_id - fixes "Unknown column 'wd_id'" error

require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function send_response($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

function log_error($msg) {
    error_log("[" . date('Y-m-d H:i:s') . "] water_management_action: " . $msg);
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $pond_id = isset($_GET['pond_id']) ? (int)$_GET['pond_id'] : null;

        $sql = "
            SELECT 
                wm_id, pond_id, action_type, scheduled_timestamp,
                action_status, created_at, updated_at
            FROM water_management_action
        ";

        $params = [];
        $types  = '';

        if ($pond_id !== null && $pond_id > 0) {
            $sql .= " WHERE pond_id = ?";
            $params[] = $pond_id;
            $types   .= 'i';
        }

        $sql .= " ORDER BY created_at DESC";

        $stmt = $conn->prepare($sql);
        if (!$stmt) throw new Exception("GET prepare failed: " . $conn->error);

        if ($types) $stmt->bind_param($types, ...$params);

        $stmt->execute();
        $result = $stmt->get_result();

        $rows = $result->fetch_all(MYSQLI_ASSOC) ?? [];

        send_response(['success' => true, 'data' => $rows, 'count' => count($rows)]);
    }
    elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        $pond_id             = (int)($input['pond_id'] ?? 0);
        $action_type         = trim($input['action_type'] ?? 'refill');
        $scheduled_timestamp = trim($input['scheduled_timestamp'] ?? '') ?: null;
        $action_status       = trim($input['action_status'] ?? 'pending');

        if ($pond_id <= 0) {
            send_response(['success' => false, 'message' => 'pond_id required (>0)'], 400);
        }

        if (!in_array($action_type, ['refill'])) {
            send_response(['success' => false, 'message' => 'action_type must be "refill"'], 400);
        }

        $sql = "
            INSERT INTO water_management_action 
            (pond_id, action_type, scheduled_timestamp, action_status)
            VALUES (?, ?, ?, ?)
        ";

        $stmt = $conn->prepare($sql);
        if (!$stmt) throw new Exception("POST prepare failed: " . $conn->error);

        $stmt->bind_param("isss", $pond_id, $action_type, $scheduled_timestamp, $action_status);

        if (!$stmt->execute()) {
            throw new Exception("Insert failed: " . $stmt->error);
        }

        send_response([
            'success' => true,
            'message' => 'Created',
            'id'      => $conn->insert_id
        ]);
    }
    else {
        send_response(['success' => false, 'message' => 'Method not allowed'], 405);
    }
}
catch (Exception $e) {
    log_error($e->getMessage());
    $resp = ['success' => false, 'message' => 'Server error'];

    // Keep debug output during development
    $resp['debug'] = [
        'error' => $e->getMessage(),
        'line'  => $e->getLine(),
        'time'  => date('Y-m-d H:i:s')
    ];

    send_response($resp, 500);
}
finally {
    $conn->close();
}