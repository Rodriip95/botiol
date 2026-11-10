/** Respuesta cruda de POST /token. */
export interface IolTokenResponse {
  access_token: string;
  token_type: string;
  /** Segundos de vida del access token. */
  expires_in: number;
  refresh_token: string;
  '.issued'?: string;
  '.expires'?: string;
  '.refreshexpires'?: string;
}

export interface IolPunta {
  cantidadCompra: number;
  precioCompra: number;
  precioVenta: number;
  cantidadVenta: number;
}

/** Respuesta cruda de GET /api/v2/{mercado}/Titulos/{simbolo}/Cotizacion (campos que usamos). */
export interface IolCotizacion {
  ultimoPrecio: number;
  variacion: number;
  apertura: number;
  maximo: number;
  minimo: number;
  fechaHora: string;
  cierreAnterior: number;
  volumenNominal?: number;
  moneda?: string;
  puntas?: IolPunta[] | null;
  [key: string]: unknown;
}

/** Plazo de liquidación. */
export type IolPlazo = 't0' | 't1' | 't2';
