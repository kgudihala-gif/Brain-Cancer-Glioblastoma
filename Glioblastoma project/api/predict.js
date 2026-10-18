export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json({ error: "Use POST." }, { status: 405, headers: { "Cache-Control": "no-store" } });
    }

    // Closed until the service owner provides the documented request contract.
    // This prevents uploads from being sent to a guessed endpoint or payload format.
    return Response.json({
      code: "MODEL_CONNECTION_PENDING",
      error: "Live MRI analysis is not connected. This preview did not upload or analyze your image.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  },
};
