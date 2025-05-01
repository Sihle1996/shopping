//package com.example.backend.controller;
//
//
//import lombok.RequiredArgsConstructor;
//import org.springframework.http.ResponseEntity;
//import org.springframework.util.StringUtils;
//import org.springframework.web.bind.annotation.*;
//import org.springframework.web.multipart.MultipartFile;
//import java.io.IOException;
//import java.nio.file.*;
//import java.util.Objects;
//
//@RestController
//@RequestMapping("/api/admin/images")
//@RequiredArgsConstructor
//public class ImageUploadController {
//
//    private static final String UPLOAD_DIR = "uploads/";
//
//    @PostMapping
//    public ResponseEntity<String> uploadImage(@RequestParam("file") MultipartFile file) throws IOException {
//        String filename = StringUtils.cleanPath(Objects.requireNonNull(file.getOriginalFilename()));
//        Path uploadPath = Paths.get(UPLOAD_DIR);
//
//        if (!Files.exists(uploadPath)) {
//            Files.createDirectories(uploadPath);
//        }
//
//        Path filePath = uploadPath.resolve(filename);
//        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
//
//        String imageUrl = "/uploads/" + filename;
//        return ResponseEntity.ok(imageUrl);
//    }
//}
//
