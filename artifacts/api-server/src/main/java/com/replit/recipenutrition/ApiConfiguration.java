package com.replit.recipenutrition;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class ApiConfiguration implements WebMvcConfigurer {
    @Bean
    @Profile("local-h2")
    ApplicationRunner syncLocalH2Identities(JdbcTemplate jdbcTemplate) {
        return args -> {
            for (String table : new String[] {"app_user", "ingredient", "recipe"}) {
                Long nextId = jdbcTemplate.queryForObject(
                        "select coalesce(max(id), 0) + 1 from " + table,
                        Long.class);
                jdbcTemplate.execute(
                        "alter table " + table + " alter column id restart with " + nextId);
            }
        };
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}