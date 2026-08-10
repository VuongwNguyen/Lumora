function activityPayloadLimit(req, res, next) {
  const maxBytes = 32 * 1024;
  const contentLength = Number.parseInt(req.headers['content-length'], 10);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return res.status(413).json({ ok: false, error: 'payload_too_large' });
  }
  let actualBytes = 0;
  try {
    actualBytes = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');
  } catch {
    return res.status(400).json({ ok: false, error: 'validation_error' });
  }
  if (actualBytes > maxBytes) {
    return res.status(413).json({ ok: false, error: 'payload_too_large' });
  }
  next();
}

module.exports = { activityPayloadLimit };
