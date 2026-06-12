using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace SuperAdmin.API.Services;

/// <summary>
/// Sends transactional emails via the Resend HTTP API (same provider + from-address as the Spring
/// backend). Used so enrollment approve/reject actually notify the store owner. Fail-open: a missing
/// key or a send failure is logged and swallowed so it never fails the approve/reject action.
/// </summary>
public class ResendEmailService(HttpClient http, IConfiguration config, ILogger<ResendEmailService> log)
{
    private readonly string? _apiKey = config["RESEND_API_KEY"] ?? config["Resend:ApiKey"];
    private readonly string _from = config["RESEND_FROM"] ?? config["Resend:From"] ?? "CraveIt <noreply@crave-it.co.za>";
    private readonly string _storeAdminUrl = (config["STORE_ADMIN_URL"] ?? config["Frontend:StoreAdminUrl"] ?? "https://crave-it.co.za").TrimEnd('/');

    public Task SendStoreApprovedAsync(string storeName, string? toEmail) =>
        SendAsync(toEmail, "Your store is approved — Welcome to CraveIt!",
            ApprovedHtml(storeName, $"{_storeAdminUrl}/admin/dashboard"));

    public Task SendStoreRejectedAsync(string storeName, string? toEmail, string? reason) =>
        SendAsync(toEmail, "Your CraveIt store application — action needed",
            RejectedHtml(storeName, reason, $"{_storeAdminUrl}/admin/enrollment"));

    /// <summary>Generic transactional email (e.g. a support-reply notification). Fail-open like the rest.</summary>
    public Task SendNotificationAsync(string? toEmail, string subject, string html) =>
        SendAsync(toEmail, subject, html);

    private async Task SendAsync(string? to, string subject, string html)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            log.LogWarning("RESEND_API_KEY not configured — skipping enrollment email");
            return;
        }
        if (string.IsNullOrWhiteSpace(to))
        {
            log.LogWarning("No recipient email on tenant — skipping enrollment email");
            return;
        }
        try
        {
            var payload = JsonSerializer.Serialize(new { from = _from, to = new[] { to }, subject, html });
            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            var resp = await http.SendAsync(req);
            if (!resp.IsSuccessStatusCode)
                log.LogWarning("Resend email failed ({Status}) to {To}", resp.StatusCode, to);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Resend email error to {To}", to);
        }
    }

    private static string Esc(string? s) => System.Net.WebUtility.HtmlEncode(s ?? "");

    private static string ApprovedHtml(string storeName, string dashboardUrl) => $@"
        <div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>
          <div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>
            <div style='background:#111827;padding:28px 36px;text-align:center;'>
              <h1 style='margin:0;color:#ffffff;font-size:20px;font-weight:700;'>CraveIt</h1>
              <p style='margin:8px 0 0;color:#9ca3af;font-size:13px;'>Store Approved 🎉</p>
            </div>
            <div style='padding:32px 36px;'>
              <p style='margin:0 0 16px;color:#374151;font-size:15px;'>Hi <strong>{Esc(storeName)}</strong>,</p>
              <p style='margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;'>Congratulations! Your store application has been <strong style='color:#10b981;'>approved</strong>. You can now log in and start accepting orders from customers.</p>
              <a href='{dashboardUrl}' style='display:inline-block;background:#E76F51;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;margin-bottom:24px;'>Go to Dashboard</a>
              <p style='margin:0;color:#6b7280;font-size:13px;line-height:1.5;'>Complete your store setup — add your menu, set your hours, and open your store when you're ready.</p>
            </div>
            <div style='background:#f9fafb;padding:16px 36px;text-align:center;border-top:1px solid #e5e7eb;'>
              <p style='margin:0;color:#9ca3af;font-size:12px;'>CraveIt Platform &mdash; noreply@crave-it.co.za</p>
            </div>
          </div>
        </div>";

    private static string RejectedHtml(string storeName, string? reason, string resubmitUrl)
    {
        var reasonBlock = string.IsNullOrWhiteSpace(reason)
            ? ""
            : $@"<div style='background:#fef2f2;border-radius:10px;padding:16px 20px;border-left:4px solid #ef4444;margin-bottom:20px;'>
                  <p style='margin:0 0 4px;color:#7f1d1d;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;'>Reason</p>
                  <p style='margin:0;color:#991b1b;font-size:14px;line-height:1.5;'>{Esc(reason)}</p>
                </div>";
        return $@"
        <div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>
          <div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>
            <div style='background:#111827;padding:28px 36px;text-align:center;'>
              <h1 style='margin:0;color:#ffffff;font-size:20px;font-weight:700;'>CraveIt</h1>
              <p style='margin:8px 0 0;color:#9ca3af;font-size:13px;'>Application Update</p>
            </div>
            <div style='padding:32px 36px;'>
              <p style='margin:0 0 16px;color:#374151;font-size:15px;'>Hi <strong>{Esc(storeName)}</strong>,</p>
              <p style='margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;'>Unfortunately, your store application was not approved at this time. Please review the feedback below, update your documents, and resubmit.</p>
              {reasonBlock}
              <a href='{resubmitUrl}' style='display:inline-block;background:#E76F51;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;'>Update &amp; Resubmit</a>
            </div>
            <div style='background:#f9fafb;padding:16px 36px;text-align:center;border-top:1px solid #e5e7eb;'>
              <p style='margin:0;color:#9ca3af;font-size:12px;'>CraveIt Platform &mdash; noreply@crave-it.co.za</p>
            </div>
          </div>
        </div>";
    }
}
