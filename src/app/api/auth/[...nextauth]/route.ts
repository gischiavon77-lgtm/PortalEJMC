/**
 * Route handler do NextAuth.js v5.
 *
 * Task 3.1: Padrão canônico do v5 — desestruturar `GET` e `POST` do
 * objeto `handlers` exportado em `@/lib/auth`. Substitui o
 * `export default NextAuth(...)` do v4.
 */

import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
