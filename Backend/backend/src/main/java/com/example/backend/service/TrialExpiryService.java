package com.example.backend.service;

import com.example.backend.entity.Tenant;
import com.example.backend.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TrialExpiryService {

    private final TenantRepository tenantRepository;
    private final EmailService emailService;

    /** Runs daily at 08:00 to expire/warn trial tenants */
    @Scheduled(cron = "0 0 8 * * *")
    public void processTrials() {
        LocalDateTime now = LocalDateTime.now();

        // Expire tenants whose trial started more than 14 days ago
        List<Tenant> expired = tenantRepository.findTrialTenantsStartedBefore(now.minusDays(14));
        for (Tenant tenant : expired) {
            tenant.setSubscriptionStatus("SUSPENDED");
            tenantRepository.save(tenant);
            log.info("Trial expired for tenant: {} ({})", tenant.getName(), tenant.getId());
            if (tenant.getEmail() != null) {
                emailService.sendRaw(
                    tenant.getEmail(),
                    "Your FastFood trial has ended",
                    buildSuspendedHtml(tenant.getName())
                );
            }
        }

        // Warn tenants at day 10 (4 days remaining)
        LocalDateTime warnFrom = now.minusDays(10).withHour(0).withMinute(0).withSecond(0);
        LocalDateTime warnTo   = now.minusDays(10).withHour(23).withMinute(59).withSecond(59);
        List<Tenant> warning = tenantRepository.findBySubscriptionStatusAndTrialStartedAtBetween(
                "TRIAL", warnFrom, warnTo);
        for (Tenant tenant : warning) {
            log.info("Sending trial warning to tenant: {} ({})", tenant.getName(), tenant.getId());
            if (tenant.getEmail() != null) {
                emailService.sendRaw(
                    tenant.getEmail(),
                    "4 days left on your FastFood trial",
                    buildWarningHtml(tenant.getName())
                );
            }
        }
    }

    private String buildSuspendedHtml(String name) {
        return "<p>Hi <strong>" + name + "</strong>,</p>" +
               "<p>Your 14-day free trial has ended and your store has been <strong>suspended</strong>.</p>" +
               "<p>To restore access, please upgrade to a paid plan by logging into your dashboard.</p>";
    }

    private String buildWarningHtml(String name) {
        return "<p>Hi <strong>" + name + "</strong>,</p>" +
               "<p>Your free trial ends in <strong>4 days</strong>.</p>" +
               "<p>Upgrade now to keep your store live and avoid any interruption to your service.</p>";
    }
}
