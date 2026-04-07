package com.example.backend.service;

import com.example.backend.entity.Category;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.CategoryRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final TenantRepository tenantRepository;

    public List<Category> getCategories() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            return categoryRepository.findByTenant_Id(tenantId);
        }
        return categoryRepository.findAll();
    }

    public Category createCategory(String name) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null && categoryRepository.existsByNameAndTenant_Id(name, tenantId)) {
            throw new IllegalArgumentException("Category already exists");
        }
        Category category = new Category();
        category.setName(name);
        if (tenantId != null) {
            Tenant tenant = tenantRepository.findById(tenantId)
                    .orElseThrow(() -> new RuntimeException("Tenant not found"));
            category.setTenant(tenant);
        }
        return categoryRepository.save(category);
    }

    public void deleteCategory(UUID id) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            categoryRepository.findByIdAndTenant_Id(id, tenantId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));
        } else if (!categoryRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found");
        }
        categoryRepository.deleteById(id);
    }
}
