package com.example.backend.config;

import com.example.backend.entity.Category;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.CategoryRepository;
import com.example.backend.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class CategorySeeder implements ApplicationRunner {

    private final TenantRepository tenantRepository;
    private final CategoryRepository categoryRepository;

    private static final List<String> DEFAULT_CATEGORIES = List.of(
            "Burgers", "Pizza", "Chicken", "Sides", "Drinks", "Desserts", "Specials"
    );

    @Override
    public void run(ApplicationArguments args) {
        List<Tenant> tenants = tenantRepository.findByActiveTrue();
        for (Tenant tenant : tenants) {
            List<Category> existing = categoryRepository.findByTenant_Id(tenant.getId());
            if (existing.isEmpty()) {
                for (String name : DEFAULT_CATEGORIES) {
                    Category cat = new Category();
                    cat.setName(name);
                    cat.setTenant(tenant);
                    categoryRepository.save(cat);
                }
                log.info("Seeded {} default categories for tenant: {}", DEFAULT_CATEGORIES.size(), tenant.getSlug());
            }
        }
    }
}
