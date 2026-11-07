using System.Globalization;
using Microsoft.Data.Sqlite;

namespace HomeSecurity.Agent;

// This is a durable INDEX OF CLOSED FILES, not an encoder or an RTSP recorder.
// No JavaScript/PWA/remote client is allowed to register or delete segments.
public sealed record CameraRecordingSegment(
    Guid Id, Guid CameraId, DateTimeOffset StartUtc, DateTimeOffset EndUtc,
    long SizeBytes, string LocalPath, bool Available);
public sealed record RecordingIndexGap(DateTimeOffset StartUtc, DateTimeOffset EndUtc);

public sealed class CameraRecordingIndex
{
    private readonly AgentDatabase database;
    private readonly string root;

    public CameraRecordingIndex(AgentDatabase database, string recordingRoot)
    {
        this.database = database ?? throw new ArgumentNullException(nameof(database));
        if (string.IsNullOrWhiteSpace(recordingRoot)) throw new ArgumentException("RECORDING_ROOT_REQUIRED");
        root = Path.GetFullPath(recordingRoot);
        if (!Directory.Exists(root)) throw new DirectoryNotFoundException("RECORDING_ROOT_MISSING");
        if ((File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0)
            throw new IOException("RECORDING_ROOT_REPARSE_POINT");
    }

    private string ValidateFile(string input)
    {
        if (string.IsNullOrWhiteSpace(input) || !Path.IsPathFullyQualified(input))
            throw new ArgumentException("RECORDING_PATH_NOT_ABSOLUTE");
        var full = Path.GetFullPath(input);
        var rel = Path.GetRelativePath(root, full);
        if (rel == "." || rel == ".." ||
            rel.StartsWith(".." + Path.DirectorySeparatorChar, StringComparison.Ordinal) ||
            Path.IsPathRooted(rel)) throw new ArgumentException("RECORDING_OUTSIDE_ROOT");
        if (!string.Equals(Path.GetExtension(full), ".mp4", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(Path.GetExtension(full), ".webm", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("RECORDING_TYPE_NOT_SUPPORTED");
        var directory = root;
        var parts = rel.Split(Path.DirectorySeparatorChar);
        for (var i = 0; i < parts.Length - 1; i++)
        {
            directory = Path.Combine(directory, parts[i]);
            if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0)
                throw new IOException("RECORDING_DIRECTORY_REPARSE_POINT");
        }
        if ((File.GetAttributes(full) & FileAttributes.ReparsePoint) != 0)
            throw new IOException("RECORDING_FILE_REPARSE_POINT");
        return full;
    }

    // Call this ONLY after a real recorder has closed and flushed the segment.
    // A retry with the same ID and identical metadata is idempotent; a conflict is rejected.
    public CameraRecordingSegment RegisterClosed(Guid id, Guid cameraId, string path,
        DateTimeOffset start, DateTimeOffset end)
    {
        if (id == Guid.Empty || cameraId == Guid.Empty) throw new ArgumentException("INVALID_SEGMENT_ID");
        start = start.ToUniversalTime();
        end = end.ToUniversalTime();
        if (end <= start || end - start > TimeSpan.FromHours(24))
            throw new ArgumentException("INVALID_RECORDING_INTERVAL");
        var verifiedPath = ValidateFile(path);
        var bytes = new FileInfo(verifiedPath).Length;
        if (bytes <= 0) throw new IOException("EMPTY_RECORDING");
        var from = start.ToString("O", CultureInfo.InvariantCulture);
        var to = end.ToString("O", CultureInfo.InvariantCulture);
        using var connection = database.Open();
        using var tx = connection.BeginTransaction();
        using (var insert = connection.CreateCommand())
        {
            insert.Transaction = tx;
            insert.CommandText = """
                INSERT INTO segments(id,camera_id,path,start_utc,end_utc,status,size_bytes)
                VALUES($id,$camera,$path,$from,$to,'closed',$bytes)
                ON CONFLICT(id) DO NOTHING
                """;
            insert.Parameters.AddWithValue("$id", id.ToString("D"));
            insert.Parameters.AddWithValue("$camera", cameraId.ToString("D"));
            insert.Parameters.AddWithValue("$path", verifiedPath);
            insert.Parameters.AddWithValue("$from", from);
            insert.Parameters.AddWithValue("$to", to);
            insert.Parameters.AddWithValue("$bytes", bytes);
            insert.ExecuteNonQuery();
        }
        using var read = connection.CreateCommand();
        read.Transaction = tx;
        read.CommandText = "SELECT camera_id,path,start_utc,end_utc,status,size_bytes FROM segments WHERE id=$id";
        read.Parameters.AddWithValue("$id", id.ToString("D"));
        using (var result = read.ExecuteReader())
        {
            if (!result.Read() || result.GetString(0) != cameraId.ToString("D") ||
                !string.Equals(result.GetString(1), verifiedPath, StringComparison.OrdinalIgnoreCase) ||
                result.GetString(2) != from || result.GetString(3) != to ||
                result.GetString(4) != "closed" || result.IsDBNull(5) || result.GetInt64(5) != bytes)
                throw new InvalidOperationException("SEGMENT_ID_CONFLICT");
        }
        tx.Commit();
        return new CameraRecordingSegment(id, cameraId, start, end, bytes, verifiedPath, true);
    }

    private bool VerifiedOnDisk(string path, long bytes)
    {
        try
        {
            // A file or parent directory may have been swapped for a symlink
            // after registration. Never report a path outside the configured root.
            if (bytes <= 0 || ValidateFile(path) != path) return false;
            return File.Exists(path) && new FileInfo(path).Length == bytes;
        }
        catch (IOException) { return false; }
        catch (UnauthorizedAccessException) { return false; }
        catch (ArgumentException) { return false; }
    }

    // UTC bounds are half-open [from, to): no cross-camera leakage and no
    // fabricated recording availability when the original file disappeared.
    public IReadOnlyList<CameraRecordingSegment> Query(Guid cameraId,
        DateTimeOffset from, DateTimeOffset to, int limit = 1000)
    {
        if (cameraId == Guid.Empty) throw new ArgumentException("INVALID_CAMERA_ID");
        from = from.ToUniversalTime(); to = to.ToUniversalTime();
        if (to <= from || limit < 1 || limit > 1000) throw new ArgumentException("INVALID_RECORDING_QUERY");
        using var connection = database.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id,camera_id,path,start_utc,end_utc,size_bytes
            FROM segments WHERE camera_id=$camera AND status='closed'
              AND start_utc<$to AND end_utc>$from
            ORDER BY start_utc ASC,id ASC LIMIT $limit
            """;
        command.Parameters.AddWithValue("$camera", cameraId.ToString("D"));
        command.Parameters.AddWithValue("$from", from.ToString("O", CultureInfo.InvariantCulture));
        command.Parameters.AddWithValue("$to", to.ToString("O", CultureInfo.InvariantCulture));
        command.Parameters.AddWithValue("$limit", limit);
        var results = new List<CameraRecordingSegment>();
        using var rows = command.ExecuteReader();
        while (rows.Read())
        {
            var p = rows.GetString(2);
            var bytes = rows.IsDBNull(5) ? 0 : rows.GetInt64(5);
            results.Add(new CameraRecordingSegment(
                Guid.Parse(rows.GetString(0)), Guid.Parse(rows.GetString(1)),
                DateTimeOffset.Parse(rows.GetString(3), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind),
                DateTimeOffset.Parse(rows.GetString(4), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind),
                bytes, p, VerifiedOnDisk(p, bytes)));
        }
        return results;
    }

    // A "gap" means NO VERIFIED INDEXED FILE for this camera and time range,
    // not proof the camera was offline. This function does not delete files.
    public IReadOnlyList<RecordingIndexGap> Gaps(Guid cameraId,
        DateTimeOffset from, DateTimeOffset to, int limit = 1000)
    {
        var intervals = Query(cameraId, from, to, limit);
        // Never silently label unexamined pages as gaps in long-running archives.
        if (intervals.Count == limit) throw new InvalidOperationException("RECORDING_COVERAGE_REQUIRES_PAGINATION");
        var cursor = from.ToUniversalTime();
        var end = to.ToUniversalTime();
        var gaps = new List<RecordingIndexGap>();
        foreach (var clip in intervals.Where(c => c.Available).OrderBy(c => c.StartUtc))
        {
            var start = clip.StartUtc < cursor ? cursor : clip.StartUtc;
            if (start > cursor) gaps.Add(new RecordingIndexGap(cursor, start));
            if (clip.EndUtc > cursor) cursor = clip.EndUtc > end ? end : clip.EndUtc;
            if (cursor >= end) break;
        }
        if (cursor < end) gaps.Add(new RecordingIndexGap(cursor, end));
        return gaps;
    }
}
