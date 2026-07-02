/**
 * ECOSYS — Generador de contraseña segura
 * Uso: node setup-password.js
 * Ejecutar UNA VEZ para obtener el hash que va en las variables de entorno de Render
 */

const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Escribe la contraseña que quieres usar: ', async (password) => {
  if (password.length < 8) {
    console.error('❌ La contraseña debe tener mínimo 8 caracteres');
    process.exit(1);
  }
  console.log('\nGenerando hash seguro...');
  const hash = await bcrypt.hash(password, 12);
  console.log('\n✅ Hash generado:\n');
  console.log(hash);
  console.log('\nCopia este valor y pégalo en Render como:');
  console.log('  Variable: ADMIN_PASSWORD_HASH');
  console.log('  Valor:    ' + hash);
  console.log('\n⚠️  Guarda tu contraseña en un lugar seguro — el hash no es reversible.\n');
  rl.close();
});
