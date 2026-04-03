<?php
// feeding_management.php
// API for managing scheduled feeding actions

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once './config.php';

if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function respond($success, $dataOrMessage = null, $httpCode = 200) {
    http_response_code($httpCode);
    $res = ['success' => $success];
    if (is_string($dataOrMessage)) {
        $res['message'] = $dataOrMessage;
    } elseif ($dataOrMessage !== null) {
        $res['data'] = $dataOrMessage;
    }
    echo json_encode($res, JSON_UNESCAPED_SLASHES);
    exit;
}

function logApi($msg) {
    error_log(date('[Y-m-d H:i:s] ') . $msg . "\n", 3, '../logs/feeding-api.log');
}

function execute($conn, $sql, $types = '', $params = []) {
    $stmt = mysqli_prepare($conn, $sql);
    if (!$stmt) {
        logApi("Prepare failed: " . mysqli_error($conn));
        respond(false, "Database error (prepare)", 500);
    }
    if ($types && $params) {
        mysqli_stmt_bind_param($stmt, $types, ...$params);
    }
    if (!mysqli_stmt_execute($stmt)) {
        logApi("Execute failed: " . mysqli_stmt_error($stmt));
        respond(false, "Database error (execute)", 500);
    }
    return $stmt;
}

function pondExists($conn, $id) {
    $stmt = execute($conn, "SELECT 1 FROM ponds WHERE id = ?", 'i', [$id]);
    $exists = mysqli_stmt_get_result($stmt)->num_rows > 0;
    mysqli_stmt_close($stmt);
    return $exists;
}

function isValidDate($str) {
    $dt = DateTime::createFromFormat('Y-m-d', $str);
    return $dt && $dt->format('Y-m-d') === $str;
}

function isValidTime($str) {
    return preg_match('/^([01]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/', $str);
}

function isValidDatetime($str) {
    $dt = DateTime::createFromFormat('Y-m-d H:i:s', $str);
    return $dt && $dt->format('Y-m-d H:i:s') === $str;
}

function validStatus($s) {
    return in_array($s, ['pending', 'feeding', 'completed', 'canceled_by_user', 'canceled_by_ai', 'failed']);
}

function validMode($m) {
    return in_array($m, ['ai mode', 'manual mode']);
}

function validUnit($u) {
    return in_array($u, ['g', 'kg']);
}

// ────────────────────────────────────────────────
// Routing
// ────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {

        // ─────── GET ───────────────────────────────────────
        case 'GET':
            $sql = "SELECT fm_id, pond_id, scheduled_timestamp, amount_of_feed,
                           feed_unit, action_status, control_mode, fd_id,
                           created_at, updated_at
                    FROM feeding_management_action";
            $where = [];
            $types = '';
            $vals  = [];

            if (!empty($_GET['fm_id']) || !empty($_GET['id'])) {
                $id = (int)($_GET['fm_id'] ?? $_GET['id']);
                $where[] = 'fm_id = ?';
                $vals[] = $id;
                $types .= 'i';
            }
            if (!empty($_GET['pond_id'])) {
                $where[] = 'pond_id = ?';
                $vals[] = (int)$_GET['pond_id'];
                $types .= 'i';
            }
            if (!empty($_GET['status'])) {
                $where[] = 'action_status = ?';
                $vals[] = $_GET['status'];
                $types .= 's';
            }
            if (!empty($_GET['future'])) {
                $where[] = 'scheduled_timestamp >= NOW()';
            }
            if (!empty($_GET['start_date']) && isValidDate($_GET['start_date'])) {
                $where[] = 'DATE(scheduled_timestamp) >= ?';
                $vals[] = $_GET['start_date'];
                $types .= 's';
            }

            if ($where) {
                $sql .= ' WHERE ' . implode(' AND ', $where);
            }

            $sql .= ' ORDER BY scheduled_timestamp DESC';

            // pagination
            $page  = max(1, (int)($_GET['page']  ?? 1));
            $limit = min(100, max(1, (int)($_GET['limit'] ?? 25)));
            $offset = ($page - 1) * $limit;

            $sql .= ' LIMIT ? OFFSET ?';
            $types .= 'ii';
            $vals[] = $limit;
            $vals[] = $offset;

            $stmt = execute($conn, $sql, $types, $vals);
            $result = mysqli_stmt_get_result($stmt);

            $records = [];
            while ($r = mysqli_fetch_assoc($result)) {
                $r['fm_id']          = (int)$r['fm_id'];
                $r['pond_id']        = (int)$r['pond_id'];
                $r['amount_of_feed'] = (float)$r['amount_of_feed'];
                $r['fd_id']          = $r['fd_id'] ? (int)$r['fd_id'] : null;
                $records[] = $r;
            }

            respond(true, ['records' => $records, 'count' => count($records)]);
            break;


        // ─────── POST ──────────────────────────────────────
        case 'POST':
            $body = json_decode(file_get_contents('php://input'), true) ?? [];

            $pond_id = (int)($body['pond_id'] ?? 0);
            if ($pond_id <= 0 || !pondExists($conn, $pond_id)) {
                respond(false, "Valid pond_id required", 400);
            }

            $amount = floatval($body['amount_of_feed'] ?? 0);
            if ($amount <= 0) {
                respond(false, "amount_of_feed must be > 0", 400);
            }

            $unit = trim($body['feed_unit'] ?? 'g');
            if (!validUnit($unit)) {
                respond(false, "feed_unit must be 'g' or 'kg'", 400);
            }

            $ts = trim($body['scheduled_timestamp'] ?? '');
            if (!$ts || !isValidDatetime($ts)) {
                respond(false, "scheduled_timestamp required (YYYY-MM-DD HH:MM:SS)", 400);
            }

            $status = 'pending';
            if (isset($body['action_status']) && validStatus($body['action_status'])) {
                $status = $body['action_status'];
            }

            $mode = 'ai mode';
            if (isset($body['control_mode']) && validMode($body['control_mode'])) {
                $mode = $body['control_mode'];
            }

            $fd_id = null;
            if (isset($body['fd_id']) && $body['fd_id'] !== '') {
                $fd_id = (int)$body['fd_id'];
                // you may add fd_id validation if table exists
            }

            $sql = "INSERT INTO feeding_management_action
                    (pond_id, scheduled_timestamp, amount_of_feed, feed_unit,
                     action_status, control_mode, fd_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)";
            
            $stmt = execute($conn, $sql, 'isdsssi', [
                $pond_id,
                $ts,
                $amount,
                $unit,
                $status,
                $mode,
                $fd_id
            ]);

            $newId = mysqli_insert_id($conn);

            logApi("Created feeding fm_id=$newId pond=$pond_id amount=$amount$unit @ $ts");

            // optional: return full record
            $fetch = execute($conn, 
                "SELECT * FROM feeding_management_action WHERE fm_id = ?",
                'i', [$newId]
            );
            $record = mysqli_fetch_assoc(mysqli_stmt_get_result($fetch));

            respond(true, $record, 201);
            break;


        // ─────── PUT ───────────────────────────────────────
        case 'PUT':
            if (empty($_GET['fm_id']) && empty($_GET['id'])) {
                respond(false, "Missing fm_id or id", 400);
            }
            $fm_id = (int)($_GET['fm_id'] ?? $_GET['id']);
            if ($fm_id <= 0) respond(false, "Invalid id", 400);

            $body = json_decode(file_get_contents('php://input'), true) ?? [];

            $sets = [];
            $types = '';
            $values = [];

            if (isset($body['action_status']) && validStatus($body['action_status'])) {
                $sets[] = 'action_status = ?';
                $values[] = $body['action_status'];
                $types .= 's';
            }

            if (isset($body['scheduled_timestamp'])) {
                $ts = trim($body['scheduled_timestamp']);
                if (isValidDatetime($ts)) {
                    $sets[] = 'scheduled_timestamp = ?';
                    $values[] = $ts;
                    $types .= 's';
                }
            }

            if (isset($body['amount_of_feed'])) {
                $amt = floatval($body['amount_of_feed']);
                if ($amt > 0) {
                    $sets[] = 'amount_of_feed = ?';
                    $values[] = $amt;
                    $types .= 'd';
                }
            }

            if (isset($body['feed_unit']) && validUnit($body['feed_unit'])) {
                $sets[] = 'feed_unit = ?';
                $values[] = $body['feed_unit'];
                $types .= 's';
            }

            if (isset($body['control_mode']) && validMode($body['control_mode'])) {
                $sets[] = 'control_mode = ?';
                $values[] = $body['control_mode'];
                $types .= 's';
            }

            if (isset($body['fd_id'])) {
                $fd = $body['fd_id'] === null ? null : (int)$body['fd_id'];
                $sets[] = 'fd_id = ?';
                $values[] = $fd;
                $types .= 'i';
            }

            if (empty($sets)) {
                respond(false, "No valid fields to update", 400);
            }

            $sets[] = 'updated_at = NOW()';
            $sql = "UPDATE feeding_management_action SET " . implode(', ', $sets) . " WHERE fm_id = ?";
            $types .= 'i';
            $values[] = $fm_id;

            execute($conn, $sql, $types, $values);

            respond(true, "Feeding action updated");
            break;


        // ─────── DELETE ────────────────────────────────────
        case 'DELETE':
            if (empty($_GET['fm_id']) && empty($_GET['id'])) {
                respond(false, "Missing fm_id or id", 400);
            }
            $fm_id = (int)($_GET['fm_id'] ?? $_GET['id']);
            if ($fm_id <= 0) respond(false, "Invalid id", 400);

            $stmt = execute($conn, "DELETE FROM feeding_management_action WHERE fm_id = ?", 'i', [$fm_id]);

            if (mysqli_stmt_affected_rows($stmt) === 0) {
                respond(false, "Record not found", 404);
            }

            respond(true, "Feeding action deleted");
            break;


        default:
            respond(false, "Method not allowed", 405);
    }
}
catch (Exception $e) {
    logApi("Exception: " . $e->getMessage());
    respond(false, "Server error", 500);
}
finally {
    mysqli_close($conn);
}