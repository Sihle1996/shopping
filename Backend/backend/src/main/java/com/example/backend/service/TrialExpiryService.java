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

        // Day 3 — early engagement nudge
        LocalDateTime day3From = now.minusDays(3).withHour(0).withMinute(0).withSecond(0);
        LocalDateTime day3To   = now.minusDays(3).withHour(23).withMinute(59).withSecond(59);
        List<Tenant> day3 = tenantRepository.findBySubscriptionStatusAndTrialStartedAtBetween(
                "TRIAL", day3From, day3To);
        for (Tenant tenant : day3) {
            log.info("Sending day-3 trial email to tenant: {} ({})", tenant.getName(), tenant.getId());
            if (tenant.getEmail() != null) {
                emailService.sendRaw(
                    tenant.getEmail(),
                    "How's your FastFood trial going?",
                    buildDay3Html(tenant.getName())
                );
            }
        }

        // Day 7 — halfway conversion nudge
        LocalDateTime day7From = now.minusDays(7).withHour(0).withMinute(0).withSecond(0);
        LocalDateTime day7To   = now.minusDays(7).withHour(23).withMinute(59).withSecond(59);
        List<Tenant> day7 = tenantRepository.findBySubscriptionStatusAndTrialStartedAtBetween(
                "TRIAL", day7From, day7To);
        for (Tenant tenant : day7) {
            log.info("Sending day-7 trial email to tenant: {} ({})", tenant.getName(), tenant.getId());
            if (tenant.getEmail() != null) {
                emailService.sendRaw(
                    tenant.getEmail(),
                    "Halfway through your trial — ready to upgrade?",
                    buildDay7Html(tenant.getName())
                );
            }
        }

        // Day 10 — warning (4 days remaining)
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

    private String buildDay3Html(String name) {
        return "<p>Hi <strong>" + name + "</strong>,</p>" +
               "<p>You're 3 days into your free trial — we hope you're enjoying FastFood!</p>" +
               "<p>Have you had a chance to explore the menu builder, driver management, and order tracking?</p>" +
               "<p>If you need any help getting set up, just reply to this email — we're happy to assist.</p>" +
               "<p><a href=\"https://fastfood.app/admin/subscription\">View plans and pricing →</a></p>";
    }

    private String buildDay7Html(String name) {
        return "<p>Hi <strong>" + name + "</strong>,</p>" +
               "<p>You're halfway through your 14-day trial. 7 days to go!</p>" +
               "<p>Ready to keep your store running after the trial? Upgrading takes less than a minute.</p>" +
               "<ul>" +
               "<li><strong>BASIC</strong> — R288/month, up to 30 menu items</li>" +
               "<li><strong>PRO</strong> — R684/month, up to 100 items + promotions</li>" +
               "<li><strong>ENTERPRISE</strong> — R1,458/month, unlimited everything</li>" +
               "</ul>" +
               "<p><a href=\"https://fastfood.app/admin/subscription\">Upgrade now →</a></p>";
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
