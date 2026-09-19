--liquibase formatted sql

--changeset recipe-nutrition:002-seed
insert into app_user(id, name, email, role, active) values
    (1, 'Kitchen Admin', 'admin@recipenutrition.local', 'ADMIN', true),
    (2, 'Mila Carter', 'mila@recipenutrition.local', 'BASIC', true);

insert into ingredient(id, name, calories_per_unit, unit) values
    (1, 'Chicken breast', 165, '100 g'),
    (2, 'Olive oil', 119, '1 tbsp'),
    (3, 'Garlic', 4, 'clove'),
    (4, 'Lemon', 17, 'half');

insert into ingredient_alternative(ingredient_id, alternative_id) values (1, 4);

insert into recipe(id, name, image_url, status, author_id) values
    (1, 'Lemon garlic chicken', 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1200&q=80', 'APPROVED', 1);

insert into recipe_ingredient(recipe_id, ingredient_id, quantity, position) values
    (1, 1, 2, 0),
    (1, 2, 1, 1),
    (1, 3, 2, 2),
    (1, 4, 1, 3);

insert into cooking_log(recipe_id, user_id, note, cooked_at) values
    (1, 2, 'The lemon brightens the sauce. I added a little extra garlic and served it with greens.', current_timestamp - interval '2' day);

insert into rating(recipe_id, user_id, rating) values (1, 2, 5);