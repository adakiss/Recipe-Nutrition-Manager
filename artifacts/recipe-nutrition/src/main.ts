import '@angular/compiler';
import 'zone.js';
import './index.css';

const [
  { bootstrapApplication },
  { provideHttpClient },
  { provideZoneChangeDetection },
  { AppComponent },
] =
  await Promise.all([
    import('@angular/platform-browser'),
    import('@angular/common/http'),
    import('@angular/core'),
    import('./app.component'),
  ]);

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(), provideZoneChangeDetection()],
})
  .catch((error) => console.error(error));