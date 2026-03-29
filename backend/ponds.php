<?php
/**
 * ponds.php - REST API for managing ponds (CRUD)
 * 
 * Supported operations:
 *  • POST   → create new pond
 *  • GET    → list all ponds
 *  → DELETE → remove pond (by pond_name or id)
 * 
 * @uses config.php for database connection ($conn)
 */

header("Content-Type: application/json");

// Development CORS – tighten this in production!
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once "config.php"; // must create $conn (mysqli)

// ────────────────────────────────────────────────
function sendResponse(bool $success, string $message = '', $data = null): never
{
    $response = ['success' => $success];
    if ($message !== '') $response['message'] = $message;
    if ($data !== null)    $response['data']    = $data;
    
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function logApiError(string $msg): void
{
    error_log("Ponds API Error: " . $msg);
}

// ────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        
        // ──────────────── CREATE ─────────────────────
        case 'POST':
            $pond_name  = trim($_POST['pond_name']  ?? '');
            $pond_size  = trim($_POST['pond_size']  ?? '');
            $num_prawns = trim($_POST['num_prawns'] ?? '');
            $age        = trim($_POST['age']        ?? '');
            $location   = trim($_POST['location']   ?? '');
            $status     = trim($_POST['status']     ?? 'new');

            // Required fields
            if (!$pond_name || !$pond_size || !$num_prawns || !$age || !$location) {
                sendResponse(false, "All fields are required: pond_name, pond_size, num_prawns, age, location");
            }

            // Basic format validation (you can make stricter)
            if (!preg_match('/^PND-\d{3,}$/', $pond_name)) {
                sendResponse(false, 'Pond name must follow format: PND-001, PND-1234, etc.');
            }

            $allowedStatuses = [
                'new', 'active', 'good', 'moderate', 'critical',
                'under_maintenance', 'inactive', 'harvested',
                'feeding_alert', 'water_alert'
            ];

            if (!in_array($status, $allowedStatuses, true)) {
                sendResponse(false, "Invalid status. Allowed: " . implode(', ', $allowedStatuses));
            }

            // Optional: prevent duplicate pond names
            $check = $conn->prepare("SELECT 1 FROM ponds WHERE pond_name = ? LIMIT 1");
            $check->bind_param("s", $pond_name);
            $check->execute();
            if ($check->get_result()->num_rows > 0) {
                sendResponse(false, "A pond with this name already exists.");
            }
            $check->close();

            // Insert
            $sql = "INSERT INTO ponds 
                    (pond_name, status, pond_size, num_prawns, age, location) 
                    VALUES (?, ?, ?, ?, ?, ?)";
            
            $stmt = $conn->prepare($sql);
            if (!$stmt) {
                logApiError("Prepare failed: " . $conn->error);
                sendResponse(false, "Database error (prepare)");
            }

            //  ↓ 6 parameters – matches 6 placeholders
            $stmt->bind_param("ssssss", $pond_name, $status, $pond_size, $num_prawns, $age, $location);

            if (!$stmt->execute()) {
                logApiError("Insert failed: " . $stmt->error);
                sendResponse(false, "Failed to create pond");
            }

            sendResponse(true, "Pond added successfully", ['id' => $conn->insert_id]);
            break;


        // ──────────────── READ ───────────────────────
        case 'GET':
            $sql = "SELECT 
                        id, pond_name, status, pond_size, num_prawns, age, 
                        location, created_at, updated_at 
                    FROM ponds 
                    ORDER BY created_at DESC";

            $result = $conn->query($sql);
            if (!$result) {
                logApiError("Query failed: " . $conn->error);
                sendResponse(false, "Failed to fetch ponds", []);
            }

            $ponds = [];
            while ($row = $result->fetch_assoc()) {
                $row['id'] = (string)$row['id'];           // consistent with frontend usage
                $ponds[] = $row;
            }

            sendResponse(true, "", $ponds);
            break;


        // ──────────────── DELETE ─────────────────────
        case 'DELETE':
            $pond_name = trim($_GET['pond_name'] ?? '');
            $pond_id   = trim($_GET['id']        ?? '');

            if (!$pond_name && !$pond_id) {
                sendResponse(false, "Missing identifier: provide 'pond_name' or 'id'");
            }

            if ($pond_id) {
                $sql = "DELETE FROM ponds WHERE id = ?";
                $stmt = $conn->prepare($sql);
                $stmt->bind_param("i", $pond_id);
            } else {
                $sql = "DELETE FROM ponds WHERE pond_name = ?";
                $stmt = $conn->prepare($sql);
                $stmt->bind_param("s", $pond_name);
            }

            if (!$stmt) {
                logApiError("Delete prepare failed: " . $conn->error);
                sendResponse(false, "Database error");
            }

            $stmt->execute();

            if ($stmt->affected_rows > 0) {
                sendResponse(true, "Pond deleted successfully");
            } else {
                sendResponse(false, "Pond not found");
            }
            break;


        default:
            http_response_code(405);
            sendResponse(false, "Method not allowed: $method");
    }
}
catch (Exception $e) {
    logApiError("Exception: " . $e->getMessage());
    http_response_code(500);
    sendResponse(false, "Internal server error");
}
finally {
    if (isset($conn)) {
        $conn->close();
    }
}