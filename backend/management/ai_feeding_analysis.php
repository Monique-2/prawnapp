<?php
// ai_feeding_analysis.php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';

if (!$conn) {
    sendError(500, 'Database connection failed');
    exit;
}

// Helper Functions
function sendError($code, $message) {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_SLASHES);
    exit;
}

function sendSuccess($data = [], $message = '') {
    $response = ['success' => true];
    if ($message) {
        $response['message'] = $message;
    }
    if ($data) {
        $response = array_merge($response, $data);
    }
    echo json_encode($response, JSON_UNESCAPED_SLASHES);
}

function sanitizeInput($conn, $input) {
    return $input !== null ? mysqli_real_escape_string($conn, trim($input)) : null;
}

function validatePondExists($conn, $pond_id) {
    $stmt = mysqli_prepare($conn, 'SELECT id FROM ponds WHERE id = ?');
    mysqli_stmt_bind_param($stmt, 'i', $pond_id);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    $exists = mysqli_num_rows($result) > 0;
    mysqli_stmt_close($stmt);
    return $exists;
}

function log_action($action, $details = '') {
    $timestamp = date('Y-m-d H:i:s');
    $entry = "[$timestamp] ACTION: $action | DETAILS: $details\n";
    error_log($entry, 3, '../logs/api.log');
}

function executeQuery($conn, $query, $types = '', $params = []) {
    $stmt = mysqli_prepare($conn, $query);
    if (!$stmt) {
        throw new Exception('Prepare failed: ' . mysqli_error($conn));
    }
    if ($types && $params) {
        mysqli_stmt_bind_param($stmt, $types, ...$params);
    }
    if (!mysqli_stmt_execute($stmt)) {
        throw new Exception('Execute failed: ' . mysqli_stmt_error($stmt));
    }
    return $stmt;
}

// Handle API Request
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            log_action('FETCH_ANALYSES', 'Fetching analysis records...');
            $query = 'SELECT id, pond_id, analysis_period, amount_feed_given, confidence_level, ai_note, result_status, created_at 
                      FROM ai_feeding_analysis';
            $params = [];
            $types = '';

            if (isset($_GET['id'])) {
                $query .= ' WHERE id = ?';
                $params[] = intval($_GET['id']);
                $types .= 'i';
            } elseif (isset($_GET['pond_id'])) {
                $query .= ' WHERE pond_id = ?';
                $params[] = intval($_GET['pond_id']);
                $types .= 'i';
            }

            if (isset($_GET['analysis_period'])) {
                $query .= empty($params) ? ' WHERE' : ' AND';
                $query .= ' analysis_period = ?';
                $params[] = sanitizeInput($conn, $_GET['analysis_period']);
                $types .= 's';
            }

            if (isset($_GET['result_status'])) {
                $query .= empty($params) ? ' WHERE' : ' AND';
                $query .= ' result_status = ?';
                $params[] = sanitizeInput($conn, $_GET['result_status']);
                $types .= 's';
            }

            $query .= ' ORDER BY created_at DESC';
            $page = max(1, intval($_GET['page'] ?? 1));
            $limit = min(100, max(1, intval($_GET['limit'] ?? 20)));
            $offset = ($page - 1) * $limit;
            $query .= ' LIMIT ? OFFSET ?';
            $params[] = $limit;
            $params[] = $offset;
            $types .= 'ii';

            $stmt = executeQuery($conn, $query, $types, $params);
            $result = mysqli_stmt_get_result($stmt);

            $data = [];
            while ($row = mysqli_fetch_assoc($result)) {
                $data[] = [
                    'id' => (int)$row['id'],
                    'pond_id' => (int)$row['pond_id'],
                    'analysis_period' => $row['analysis_period'],
                    'amount_feed_given' => (float)$row['amount_feed_given'],
                    'confidence_level' => (float)$row['confidence_level'],
                    'ai_note' => $row['ai_note'],
                    'result_status' => $row['result_status'],
                    'created_at' => $row['created_at']
                ];
            }

            $countQuery = str_replace(
                'SELECT id, pond_id, analysis_period, amount_feed_given, confidence_level, ai_note, result_status, created_at',
                'SELECT COUNT(*) as total',
                $query
            );
            $countQuery = preg_replace('/ORDER BY.*$/s', '', $countQuery);
            $countQuery = preg_replace('/LIMIT \? OFFSET \?$/s', '', $countQuery);
            $countTypes = substr($types, 0, -2);
            $countParams = array_slice($params, 0, -2);
            $countStmt = executeQuery($conn, $countQuery, $countTypes, $countParams);
            $countResult = mysqli_stmt_get_result($countStmt);
            $total = mysqli_fetch_assoc($countResult)['total'] ?? 0;
            mysqli_stmt_close($countStmt);

            sendSuccess([
                'data' => $data,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => (int)$total,
                    'pages' => ceil($total / $limit)
                ]
            ]);
            mysqli_stmt_close($stmt);
            break;

        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                sendError(400, 'Invalid JSON input');
            }

            $required_fields = ['pond_id', 'analysis_period'];
            foreach ($required_fields as $field) {
                if (!isset($input[$field]) || $input[$field] === '') {
                    sendError(400, "Missing or empty required field: $field");
                }
            }

            $pond_id = intval($input['pond_id']);
            if ($pond_id <= 0 || !validatePondExists($conn, $pond_id)) {
                sendError(400, 'Invalid or non-existent pond_id');
            }

            $analysis_period = trim($input['analysis_period']);
            $amount_feed_given = isset($input['amount_feed_given']) ? floatval($input['amount_feed_given']) : 0.00;
            $confidence_level = isset($input['confidence_level']) ? floatval($input['confidence_level']) : 0.00;
            $ai_note = isset($input['ai_note']) ? trim($input['ai_note']) : null;
            $result_status = isset($input['result_status']) && in_array($input['result_status'], ['optimal', 'underfed', 'overfed', 'user_error', 'system_error'])
                ? $input['result_status'] : 'optimal';

            if (!in_array($analysis_period, ['daily', 'weekly', 'monthly'])) {
                sendError(400, 'Invalid analysis_period. Must be one of: daily, weekly, monthly');
            }
            if ($amount_feed_given < 0) {
                sendError(400, 'amount_feed_given must be non-negative');
            }
            if ($confidence_level < 0 || $confidence_level > 1) {
                sendError(400, 'confidence_level must be between 0.00 and 1.00');
            }

            $query = 'INSERT INTO ai_feeding_analysis 
                (pond_id, analysis_period, amount_feed_given, confidence_level, ai_note, result_status) 
                VALUES (?, ?, ?, ?, ?, ?)';
            $stmt = executeQuery($conn, $query, 'isddss', [
                $pond_id,
                $analysis_period,
                $amount_feed_given,
                $confidence_level,
                $ai_note,
                $result_status
            ]);

            $new_id = mysqli_insert_id($conn);
            log_action('CREATE_ANALYSIS', "New record ID: $new_id for pond: $pond_id");
            sendSuccess(['id' => $new_id], 'Analysis record added successfully');
            mysqli_stmt_close($stmt);
            break;

        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                sendError(400, 'Invalid JSON input');
            }

            if (empty($_GET['id'])) {
                sendError(400, 'Missing ID in query parameter');
            }

            $id = intval($_GET['id']);
            if ($id <= 0) {
                sendError(400, 'Invalid ID');
            }

            log_action('UPDATE_ANALYSIS_ATTEMPT', "ID: $id, Input: " . json_encode($input));

            $checkStmt = executeQuery($conn, 'SELECT id FROM ai_feeding_analysis WHERE id = ?', 'i', [$id]);
            $checkResult = mysqli_stmt_get_result($checkStmt);
            if (mysqli_num_rows($checkResult) === 0) {
                sendError(404, 'Analysis record not found');
            }
            mysqli_stmt_close($checkStmt);

            $fields = [];
            $types = '';
            $params = [];

            $allowed_fields = [
                'pond_id' => ['type' => 'i', 'validate' => function($val) use ($conn) { return $val > 0 && validatePondExists($conn, $val); }],
                'analysis_period' => ['type' => 's', 'validate' => function($val) { return in_array($val, ['daily', 'weekly', 'monthly']); }],
                'amount_feed_given' => ['type' => 'd', 'validate' => function($val) { return $val >= 0; }],
                'confidence_level' => ['type' => 'd', 'validate' => function($val) { return $val >= 0 && $val <= 1; }],
                'ai_note' => ['type' => 's', 'validate' => function($val) { return true; }],
                'result_status' => ['type' => 's', 'validate' => function($val) { return in_array($val, ['optimal', 'underfed', 'overfed', 'user_error', 'system_error']); }]
            ];

            foreach ($allowed_fields as $field => $config) {
                if (isset($input[$field]) && $input[$field] !== '') {
                    $val = trim($input[$field]);
                    $validator = $config['validate'];
                    $isValid = $validator($val);
                    if (!$isValid) {
                        sendError(400, "Invalid value for $field");
                    }
                    $fields[] = "$field = ?";
                    $types .= $config['type'];
                    $params[] = ($config['type'] === 'd') ? floatval($val) : (($config['type'] === 'i') ? intval($val) : $val);
                }
            }

            if (empty($fields)) {
                sendError(400, 'No valid fields provided for update');
            }

            $query = 'UPDATE ai_feeding_analysis SET ' . implode(', ', $fields) . ' WHERE id = ?';
            $types .= 'i';
            $params[] = $id;

            $stmt = executeQuery($conn, $query, $types, $params);
            log_action('UPDATE_ANALYSIS_SUCCESS', "Record ID: $id updated with fields: " . implode(', ', array_keys($input)));
            sendSuccess([], 'Analysis record updated successfully');
            mysqli_stmt_close($stmt);
            break;

        case 'DELETE':
            if (empty($_GET['id'])) {
                sendError(400, 'Missing ID parameter');
            }

            $id = intval($_GET['id']);
            if ($id <= 0) {
                sendError(400, 'Invalid ID');
            }

            $checkStmt = executeQuery($conn, 'SELECT id FROM ai_feeding_analysis WHERE id = ?', 'i', [$id]);
            $checkResult = mysqli_stmt_get_result($checkStmt);
            if (mysqli_num_rows($checkResult) === 0) {
                sendError(404, 'Analysis record not found');
            }
            mysqli_stmt_close($checkStmt);

            $stmt = executeQuery($conn, 'DELETE FROM ai_feeding_analysis WHERE id = ?', 'i', [$id]);
            log_action('DELETE_ANALYSIS', "Record ID: $id deleted");
            sendSuccess([], 'Analysis record deleted successfully');
            mysqli_stmt_close($stmt);
            break;

        default:
            sendError(405, 'Method not allowed');
            break;
    }
} catch (Exception $e) {
    log_action('API_ERROR', $e->getMessage());
    sendError(500, 'Internal server error: ' . $e->getMessage());
} finally {
    if (isset($conn)) {
        mysqli_close($conn);
    }
}
?>