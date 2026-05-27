import readline from 'readline';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('--- Setting up Server Environment ---');

rl.question('Enter new Admin-Password: ', async (password) => {
    if (!password || password.trim().length < 4) {
        console.error('Error: Password requires at least 4 character!');
        rl.close();
        return;
    }

    try {
        console.log('Hash generating...');
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const port = 'PORT=2376';
        const jwtSecret = `JWT_SECRET=secret_${Math.random().toString(36).substring(2, 15)}`;
        const passHashLine = `ADMIN_PASSWORD_HASH=${hash}`;

        let newEnvContent = '';

        if (fs.existsSync(envPath)) {
            console.log('.env File exists. Update password...');
            const currentContent = fs.readFileSync(envPath, 'utf8');
            const lines = currentContent.split('\n');
            let passwordUpdated = false;

            const updatedLines = lines.map(line => {
                if (line.startsWith('ADMIN_PASSWORD_HASH=')) {
                    passwordUpdated = true;
                    return passHashLine;
                }
                return line;
            });

            if (!passwordUpdated) {
                updatedLines.push(passHashLine);
            }

            newEnvContent = updatedLines.join('\n');
        } else {
            console.log('Create new file .env...');
            newEnvContent = `${port}\n${jwtSecret}\n${passHashLine}\n`;
        }
        fs.writeFileSync(envPath, newEnvContent, 'utf8');
        
        console.log('\n✅ Success! File .env updated.');
        console.log('Hash was updated successfully.');

    } catch (err) {
        console.error('Something went wrong:', err.message);
    } finally {
        rl.close();
    }
});