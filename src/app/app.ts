
import {
  Component,
  OnInit,
  signal
} from '@angular/core';

import { RouterOutlet } from '@angular/router';

type Tema = 'light' | 'dark';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  readonly tema = signal<Tema>('light');

  ngOnInit(): void {
    const guardado = localStorage.getItem('plazoleta-tema');

    let temaInicial: Tema = 'light';

    if (guardado === 'light' || guardado === 'dark') {
      temaInicial = guardado;
    } else if (
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      temaInicial = 'dark';
    }

    this.aplicarTema(temaInicial);
  }

  alternarTema(): void {
    const siguiente: Tema =
      this.tema() === 'dark' ? 'light' : 'dark';

    this.aplicarTema(siguiente);
  }

  private aplicarTema(tema: Tema): void {
    this.tema.set(tema);

    document.documentElement.setAttribute(
      'data-theme',
      tema
    );

    localStorage.setItem('plazoleta-tema', tema);
  }
}
