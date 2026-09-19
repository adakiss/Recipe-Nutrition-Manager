package com.replit.recipenutrition;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.*;

@RestController
public class RecipeController {
    private final JdbcTemplate jdbc;

    public RecipeController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/healthz")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping("/me")
    public Map<String, Object> me(HttpServletRequest request) {
        return user(currentUserId(request));
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@RequestParam(required = false) String search) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recipeCount", jdbc.queryForObject("select count(*) from recipe where status = 'APPROVED'", Integer.class));
        result.put("ingredientCount", jdbc.queryForObject("select count(*) from ingredient", Integer.class));
        result.put("pendingApprovalCount", jdbc.queryForObject("select count(*) from recipe where status = 'PENDING'", Integer.class));
        Double average = jdbc.queryForObject("select coalesce(avg(rating), 0) from rating", Double.class);
        result.put("averageRating", average == null ? 0.0 : average);
        result.put("recentRecipes", jdbc.queryForList("""
                select id from recipe where status = 'APPROVED'
                order by created_at desc limit 5
                """).stream().map(row -> recipe(((Number) row.get("id")).longValue())).toList());
        return result;
    }

    @GetMapping("/ingredients")
    public List<Map<String, Object>> ingredients(@RequestParam(required = false) String search) {
        String term = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        return jdbc.queryForList("""
                select id, name, calories_per_unit as "caloriesPerUnit", unit
                from ingredient
                where lower(name) like ?
                order by name
                """, "%" + term + "%").stream().map(this::ingredientWithAlternatives).toList();
    }

    @GetMapping("/ingredients/{id}")
    public Map<String, Object> ingredient(@PathVariable long id) {
        return ingredientWithAlternatives(one("select id, name, calories_per_unit as \"caloriesPerUnit\", unit from ingredient where id = ?", id));
    }

    @PostMapping("/ingredients")
    public ResponseEntity<Map<String, Object>> createIngredient(@RequestBody Map<String, Object> input) {
        requireText(input, "name");
        requireNumber(input, "caloriesPerUnit");
        requireText(input, "unit");
        jdbc.update("insert into ingredient(name, calories_per_unit, unit) values (?, ?, ?)",
                input.get("name"), number(input.get("caloriesPerUnit")), input.get("unit"));
        long id = lastId("ingredient");
        setAlternatives(id, ids(input.get("alternativeIds")));
        return ResponseEntity.status(HttpStatus.CREATED).body(ingredient(id));
    }

    @PatchMapping("/ingredients/{id}")
    public Map<String, Object> updateIngredient(@PathVariable long id, @RequestBody Map<String, Object> input) {
        ingredient(id);
        jdbc.update("""
                update ingredient set name = coalesce(?, name),
                calories_per_unit = coalesce(?, calories_per_unit),
                unit = coalesce(?, unit) where id = ?
                """, input.get("name"), input.get("caloriesPerUnit") == null ? null : number(input.get("caloriesPerUnit")),
                input.get("unit"), id);
        if (input.containsKey("alternativeIds")) setAlternatives(id, ids(input.get("alternativeIds")));
        return ingredient(id);
    }

    @DeleteMapping("/ingredients/{id}")
    public ResponseEntity<Void> deleteIngredient(@PathVariable long id) {
        ingredient(id);
        jdbc.update("delete from ingredient where id = ?", id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/recipes")
    public List<Map<String, Object>> recipes(@RequestParam(required = false) String search,
                                             @RequestParam(required = false) String status,
                                             @RequestParam(required = false) Boolean mine,
                                             HttpServletRequest request) {
        String term = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        String effectiveStatus = status == null || status.isBlank() ? "APPROVED" : status;
        boolean includeAll = isAdmin(currentUserId(request)) && "ALL".equalsIgnoreCase(effectiveStatus);
        String sql = """
                select id from recipe
                where lower(name) like ?
                and (? = true or status = ?)
                and (? = false or author_id = ?)
                order by created_at desc
                """;
        return jdbc.queryForList(sql, "%" + term + "%", includeAll, includeAll ? "APPROVED" : effectiveStatus,
                Boolean.TRUE.equals(mine), currentUserId(request)).stream()
                .map(row -> recipe(((Number) row.get("id")).longValue())).toList();
    }

    @GetMapping("/recipes/{id}")
    public Map<String, Object> getRecipe(@PathVariable long id) {
        return recipe(id);
    }

    @PostMapping("/recipes")
    public ResponseEntity<Map<String, Object>> createRecipe(@RequestBody Map<String, Object> input,
                                                             HttpServletRequest request) {
        requireText(input, "name");
        List<Map<String, Object>> lines = recipeLines(input.get("ingredients"));
        long authorId = currentUserId(request);
        String status = isAdmin(authorId) ? "APPROVED" : "PENDING";
        jdbc.update("insert into recipe(name, image_url, status, author_id) values (?, ?, ?, ?)",
                input.get("name"), input.get("imageUrl"), status, authorId);
        long id = lastId("recipe");
        replaceRecipeLines(id, lines);
        return ResponseEntity.status(HttpStatus.CREATED).body(recipe(id));
    }

    @PatchMapping("/recipes/{id}")
    public Map<String, Object> updateRecipe(@PathVariable long id, @RequestBody Map<String, Object> input,
                                            HttpServletRequest request) {
        Map<String, Object> existing = recipe(id);
        long current = currentUserId(request);
        if (!isAdmin(current) && ((Number) ((Map<?, ?>) existing.get("author")).get("id")).longValue() != current) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author or an admin can edit this recipe");
        }
        jdbc.update("update recipe set name = coalesce(?, name), image_url = coalesce(?, image_url) where id = ?",
                input.get("name"), input.containsKey("imageUrl") ? input.get("imageUrl") : null, id);
        if (input.containsKey("ingredients")) replaceRecipeLines(id, recipeLines(input.get("ingredients")));
        return recipe(id);
    }

    @DeleteMapping("/recipes/{id}")
    public ResponseEntity<Void> deleteRecipe(@PathVariable long id, HttpServletRequest request) {
        recipe(id);
        requireAdminOrAuthor(id, currentUserId(request));
        jdbc.update("delete from recipe where id = ?", id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/recipes/{id}/comments")
    public ResponseEntity<Map<String, Object>> addComment(@PathVariable long id,
                                                          @RequestBody Map<String, Object> input,
                                                          HttpServletRequest request) {
        recipe(id);
        requireText(input, "note");
        jdbc.update("insert into cooking_log(recipe_id, user_id, note, cooked_at) values (?, ?, ?, coalesce(?, current_timestamp))",
                id, currentUserId(request), input.get("note"), input.get("cookedAt"));
        long logId = lastId("cooking_log");
        return ResponseEntity.status(HttpStatus.CREATED).body(cookingLog(logId));
    }

    @PutMapping("/recipes/{id}/rating")
    public Map<String, Object> rate(@PathVariable long id, @RequestBody Map<String, Object> input,
                                    HttpServletRequest request) {
        recipe(id);
        int rating = ((Number) input.getOrDefault("rating", 0)).intValue();
        if (rating < 1 || rating > 5) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rating must be between 1 and 5");
        long userId = currentUserId(request);
        Integer count = jdbc.queryForObject("select count(*) from rating where recipe_id = ? and user_id = ?", Integer.class, id, userId);
        if (count != null && count > 0) {
            jdbc.update("update rating set rating = ? where recipe_id = ? and user_id = ?", rating, id, userId);
        } else {
            jdbc.update("insert into rating(recipe_id, user_id, rating) values (?, ?, ?)", id, userId, rating);
        }
        return recipe(id);
    }

    @PostMapping("/recipes/{id}/approval")
    public Map<String, Object> approve(@PathVariable long id, @RequestBody Map<String, Object> input,
                                       HttpServletRequest request) {
        requireAdmin(currentUserId(request));
        String status = String.valueOf(input.getOrDefault("status", ""));
        if (!Set.of("APPROVED", "REJECTED").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be APPROVED or REJECTED");
        }
        recipe(id);
        jdbc.update("update recipe set status = ? where id = ?", status, id);
        return recipe(id);
    }

    @GetMapping("/users")
    public List<Map<String, Object>> users(HttpServletRequest request) {
        requireAdmin(currentUserId(request));
        return jdbc.queryForList("select id, name, email, role, active, created_at as \"createdAt\" from app_user order by created_at")
                .stream().map(this::normalizeUser).toList();
    }

    @PostMapping("/users")
    public ResponseEntity<Map<String, Object>> createUser(@RequestBody Map<String, Object> input,
                                                          HttpServletRequest request) {
        requireAdmin(currentUserId(request));
        requireText(input, "name");
        requireText(input, "email");
        String role = String.valueOf(input.getOrDefault("role", "BASIC"));
        if (!Set.of("ADMIN", "BASIC").contains(role)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role must be ADMIN or BASIC");
        jdbc.update("insert into app_user(name, email, role, active) values (?, ?, ?, true)",
                input.get("name"), input.get("email"), role);
        return ResponseEntity.status(HttpStatus.CREATED).body(user(lastId("app_user")));
    }

    private Map<String, Object> recipe(long id) {
        Map<String, Object> row = one("""
                select id, name, image_url as "imageUrl", status, author_id, created_at as "createdAt"
                from recipe where id = ?
                """, id);
        Map<String, Object> result = new LinkedHashMap<>(row);
        result.put("author", user(((Number) row.get("author_id")).longValue()));
        result.remove("author_id");
        result.put("ingredients", jdbc.queryForList("""
                select ri.ingredient_id as "ingredientId", ri.quantity,
                i.name as "ingredientName", i.unit,
                (ri.quantity * i.calories_per_unit) as calories
                from recipe_ingredient ri join ingredient i on i.id = ri.ingredient_id
                where ri.recipe_id = ? order by ri.position
                """, id));
        result.put("comments", jdbc.queryForList("""
                select id, user_id, note, cooked_at as "cookedAt"
                from cooking_log where recipe_id = ? order by cooked_at desc
                """, id).stream().map(log -> {
            Map<String, Object> item = new LinkedHashMap<>(log);
            item.put("user", user(((Number) log.get("user_id")).longValue()));
            item.remove("user_id");
            return item;
        }).toList());
        Double average = jdbc.queryForObject("select coalesce(avg(rating), 0) from rating where recipe_id = ?", Double.class, id);
        Integer count = jdbc.queryForObject("select count(*) from rating where recipe_id = ?", Integer.class, id);
        result.put("averageRating", average == null ? 0.0 : Math.round(average * 10.0) / 10.0);
        result.put("ratingCount", count == null ? 0 : count);
        double total = ((List<Map<String, Object>>) result.get("ingredients")).stream()
                .mapToDouble(line -> ((Number) line.get("calories")).doubleValue()).sum();
        result.put("totalCalories", Math.round(total * 10.0) / 10.0);
        return result;
    }

    private Map<String, Object> ingredientWithAlternatives(Map<String, Object> item) {
        long id = ((Number) item.get("id")).longValue();
        item.put("alternatives", jdbc.queryForList("""
                select i.id, i.name from ingredient i
                join ingredient_alternative a on a.alternative_id = i.id
                where a.ingredient_id = ? order by i.name
                """, id));
        return item;
    }

    private Map<String, Object> cookingLog(long id) {
        Map<String, Object> row = one("select id, recipe_id, user_id, note, cooked_at as \"cookedAt\" from cooking_log where id = ?", id);
        Map<String, Object> result = new LinkedHashMap<>(row);
        result.put("user", user(((Number) row.get("user_id")).longValue()));
        result.remove("user_id");
        result.remove("recipe_id");
        return result;
    }

    private Map<String, Object> user(long id) {
        return normalizeUser(one("select id, name, email, role, active, created_at as \"createdAt\" from app_user where id = ?", id));
    }

    private Map<String, Object> normalizeUser(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>(row);
        result.put("role", String.valueOf(result.get("role")).toUpperCase(Locale.ROOT));
        return result;
    }

    private void replaceRecipeLines(long recipeId, List<Map<String, Object>> lines) {
        jdbc.update("delete from recipe_ingredient where recipe_id = ?", recipeId);
        int position = 0;
        for (Map<String, Object> line : lines) {
            long ingredientId = ((Number) line.get("ingredientId")).longValue();
            ingredient(ingredientId);
            jdbc.update("insert into recipe_ingredient(recipe_id, ingredient_id, quantity, position) values (?, ?, ?, ?)",
                    recipeId, ingredientId, number(line.get("quantity")), position++);
        }
    }

    private void setAlternatives(long ingredientId, List<Long> alternatives) {
        jdbc.update("delete from ingredient_alternative where ingredient_id = ?", ingredientId);
        for (Long alternative : alternatives) {
            if (alternative != ingredientId) jdbc.update("insert into ingredient_alternative(ingredient_id, alternative_id) values (?, ?)", ingredientId, alternative);
        }
    }

    private List<Map<String, Object>> recipeLines(Object raw) {
        if (!(raw instanceof List<?> list) || list.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one ingredient is required");
        return list.stream().filter(Map.class::isInstance).map(value -> {
            Map<?, ?> source = (Map<?, ?>) value;
            Map<String, Object> line = new HashMap<>();
            line.put("ingredientId", source.get("ingredientId"));
            line.put("quantity", source.get("quantity"));
            if (!(source.get("ingredientId") instanceof Number) || !(source.get("quantity") instanceof Number)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each ingredient needs an id and quantity");
            }
            return line;
        }).toList();
    }

    private List<Long> ids(Object raw) {
        if (!(raw instanceof List<?> list)) return List.of();
        return list.stream().filter(Number.class::isInstance).map(value -> ((Number) value).longValue()).toList();
    }

    private long currentUserId(HttpServletRequest request) {
        String header = request.getHeader("X-User-Id");
        if (header == null || header.isBlank()) return 2L;
        try {
            long id = Long.parseLong(header);
            user(id);
            return id;
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid X-User-Id");
        }
    }

    private boolean isAdmin(long id) {
        return "ADMIN".equalsIgnoreCase(String.valueOf(user(id).get("role")));
    }

    private void requireAdmin(long id) {
        if (!isAdmin(id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
    }

    private void requireAdminOrAuthor(long recipeId, long userId) {
        if (isAdmin(userId)) return;
        long author = ((Number) one("select author_id from recipe where id = ?", recipeId).get("author_id")).longValue();
        if (author != userId) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author or an admin can modify this recipe");
    }

    private Map<String, Object> one(String sql, Object... args) {
        try {
            return jdbc.queryForMap(sql, args);
        } catch (EmptyResultDataAccessException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Resource not found");
        }
    }

    private long lastId(String table) {
        return jdbc.queryForObject("select id from " + table + " order by id desc limit 1", Long.class);
    }

    private void requireText(Map<String, Object> input, String key) {
        if (!(input.get(key) instanceof String value) || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " is required");
        }
    }

    private void requireNumber(Map<String, Object> input, String key) {
        if (!(input.get(key) instanceof Number)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " is required");
    }

    private double number(Object value) {
        return ((Number) value).doubleValue();
    }
}