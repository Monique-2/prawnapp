<?php
// backend/management/water_management_action.php
// Updated version - supports cancel action + better error handling

require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
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
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST ?? $_GET;
    $wm_id = isset($_GET['wm_id']) ? (int)$_GET['wm_id'] : (int)($input['wm_id'] ?? 0);
    $pond_id = isset($_GET['pond_id']) ? (int)$_GET['pond_id'] : (int)($input['pond_id'] ?? 0);

    if ($method === 'GET') {
        // Fetch all or by pond_id
        $sql = "
            SELECT 
                wm_id, pond_id, water_quality_parameters_id, action_type, 
                scheduled_timestamp, action_status, created_at, updated_at
            FROM water_management_action
        ";

        $params = [];
        $types  = '';

        $where = [];
        if ($pond_id > 0) {
            $where[] = "pond_id = ?";
            $params[] = $pond_id;
            $types .= 'i';
        }
        if ($wm_id > 0) {
            $where[] = "wm_id = ?";
            $params[] = $wm_id;
            $types .= 'i';
        }

        if (!empty($where)) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }

        $sql .= " ORDER BY created_at DESC";

        $stmt = $conn->prepare($sql);
        if (!$stmt) throw new Exception("GET prepare failed: " . $conn->error);

        if ($types) $stmt->bind_param($types, ...$params);

        $stmt->execute();
        $result = $stmt->get_result();
        $rows = $result->fetch_all(MYSQLI_ASSOC) ?? [];

        send_response([
            'success' => true, 
            'data' => $rows, 
            'count' => count($rows)
        ]);
    }
    elseif ($method === 'POST') {
        // Create new water management action
        $pond_id             = (int)($input['pond_id'] ?? 0);
        $action_type         = trim($input['action_type'] ?? '');
        $scheduled_timestamp = !empty($input['scheduled_timestamp']) ? trim($input['scheduled_timestamp']) : null;
        $action_status       = trim($input['action_status'] ?? 'pending');

        if ($pond_id <= 0) {
            send_response(['success' => false, 'message' => 'Valid pond_id is required'], 400);
        }

        $valid_types = ['refill from freshwater', 'refill from brackishwater'];
        if (!in_array($action_type, $valid_types)) {
            send_response(['success' => false, 'message' => 'Invalid action_type. Allowed: ' . implode(', ', $valid_types)], 400);
        }

        $sql = "
            INSERT INTO water_management_action 
            (pond_id, action_type, scheduled_timestamp, action_status)
            VALUES (?, ?, ?, ?)
        ";

        $stmt = $conn->prepare($sql);
        if (!$stmt) throw new Exception("POST prepare failed: " . $conn->error);

        // 's' for scheduled_timestamp even if NULL (MySQL handles it)
        $stmt->bind_param("isss", $pond_id, $action_type, $scheduled_timestamp, $action_status);

        if (!$stmt->execute()) {
            throw new Exception("Insert failed: " . $stmt->error);
        }

        send_response([
            'success' => true,
            'message' => 'Water management action created successfully',
            'id'      => $conn->insert_id
        ]);
    }
    elseif ($method === 'PUT' || $method === 'DELETE') {
        // Update status or Cancel action
        if ($wm_id <= 0) {
            send_response(['success' => false, 'message' => 'wm_id is required'], 400);
        }

        $new_status = $method === 'DELETE' 
            ? 'canceled' 
            : trim($input['action_status'] ?? 'canceled');

        $valid_statuses = ['pending', 'in_progress', 'completed', 'canceled', 'failed'];
        if (!in_array($new_status, $valid_statuses)) {
            send_response(['success' => false, 'message' => 'Invalid action_status'], 400);
        }

        $sql = "
            UPDATE water_management_action 
            SET action_status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE wm_id = ?
        ";

        $stmt = $conn->prepare($sql);
        if (!$stmt) throw new Exception("UPDATE/DELETE prepare failed: " . $conn->error);

        $stmt->bind_param("si", $new_status, $wm_id);

        if (!$stmt->execute()) {
            throw new Exception("Update failed: " . $stmt->error);
        }

        if ($stmt->affected_rows > 0) {
            send_response([
                'success' => true,
                'message' => $method === 'DELETE' ? 'Action canceled' : 'Status updated',
                'wm_id'   => $wm_id,
                'new_status' => $new_status
            ]);
        } else {
            send_response(['success' => false, 'message' => 'Action not found or already updated'], 404);
        }
    }
    else {
        send_response(['success' => false, 'message' => 'Method not allowed'], 405);
    }
}
catch (Exception $e) {
    log_error($e->getMessage());
    $resp = [
        'success' => false, 
        'message' => 'Server error: ' . $e->getMessage()
    ];

    // Remove debug in production
    $resp['debug'] = [
        'error' => $e->getMessage(),
        'line'  => $e->getLine(),
        'time'  => date('Y-m-d H:i:s')
    ];

    send_response($resp, 500);
}
finally {
    if (isset($conn)) $conn->close();
}