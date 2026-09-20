import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { DashboardSummary, Ingredient, IngredientInput, Recipe, RecipeInput, User, UserInput, CookingLogInput, RatingInput } from '@workspace/api-client-react';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/api`;
  errorMessage(error: any): string { return error?.error?.error || error?.message || 'The kitchen could not complete that request. Please try again.'; }
  private get<T>(path: string, params?: Record<string, string>) { let p = new HttpParams(); Object.entries(params || {}).forEach(([k,v]) => p = p.set(k,v)); return this.http.get<T>(`${this.base}${path}`, { params: p }); }
  me(): Observable<User> { return this.get<User>('/me'); }
  dashboard(): Observable<DashboardSummary> { return this.get<DashboardSummary>('/dashboard'); }
  recipes(status?: 'APPROVED' | 'PENDING' | 'REJECTED', search?: string): Observable<Recipe[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (search) params.search = search;
    return this.get<Recipe[]>('/recipes', params);
  }
  recipe(id: number): Observable<Recipe> { return this.get<Recipe>(`/recipes/${id}`); }
  ingredients(search?: string): Observable<Ingredient[]> { return this.get<Ingredient[]>('/ingredients', search ? { search } : undefined); }
  users(): Observable<User[]> { return this.get<User[]>('/users'); }
  createRecipe(body: RecipeInput): Observable<Recipe> { return this.http.post<Recipe>(`${this.base}/recipes`, body); }
  updateRecipe(id: number, body: Partial<RecipeInput>): Observable<Recipe> { return this.http.patch<Recipe>(`${this.base}/recipes/${id}`, body); }
  deleteRecipe(id: number) { return this.http.delete(`${this.base}/recipes/${id}`); }
  approveRecipe(id: number, status: 'APPROVED' | 'REJECTED'): Observable<Recipe> { return this.http.post<Recipe>(`${this.base}/recipes/${id}/approval`, { status }); }
  createIngredient(body: IngredientInput): Observable<Ingredient> { return this.http.post<Ingredient>(`${this.base}/ingredients`, body); }
  updateIngredient(id: number, body: Partial<IngredientInput>): Observable<Ingredient> { return this.http.patch<Ingredient>(`${this.base}/ingredients/${id}`, body); }
  deleteIngredient(id: number) { return this.http.delete(`${this.base}/ingredients/${id}`); }
  createUser(body: UserInput): Observable<User> { return this.http.post<User>(`${this.base}/users`, body); }
  comment(id: number, body: CookingLogInput) { return this.http.post(`${this.base}/recipes/${id}/comments`, body); }
  rate(id: number, body: RatingInput) { return this.http.put(`${this.base}/recipes/${id}/rating`, body); }
}