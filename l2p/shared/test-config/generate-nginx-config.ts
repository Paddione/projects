#!/usr/bin/env node

/**
 * Nginx Configuration Generator for Blue-Green Deployment
 * Generates environment-specific nginx configurations
 */

import * as fs from 'fs';
import * as path from 'path';

interface NginxConfigOptions {
  environment: 'blue' | 'green';
  domain: string;
  backendPort: number;
  frontendPort: number;
  sslEnabled: boolean;
  templatePath?: string;
  outputPath?: string;
}

export class NginxConfigGenerator {
  private projectRoot: string;

  constructor() {
    this.projectRoot = this.findProjectRoot();
  }

  /**
   * Generate nginx configuration for specific environment
   */
  generateConfig(options: NginxConfigOptions): string {
    const templatePath = options.templatePath || path.join(this.projectRoot, 'nginx', 'blue-green-template.conf');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    const template = fs.readFileSync(templatePath, 'utf8');
    
    // Replace template variables
    let config = template;
    
    // Replace environment-specific upstreams
    if (options.environment === 'blue') {
      config = config.replace(/proxy_pass http:\/\/backend_green/g, 'proxy_pass http://backend_blue');
      config = config.replace(/proxy_pass http:\/\/frontend_green/g, 'proxy_pass http://frontend_blue');
    } else {
      config = config.replace(/proxy_pass http:\/\/backend_blue/g, 'proxy_pass http://backend_green');
      config = config.replace(/proxy_pass http:\/\/frontend_blue/g, 'proxy_pass http://frontend_green');
    }
    
    // Replace port numbers
    config = config.replace(/server localhost:3001/g, `server localhost:${options.backendPort}`);
    config = config.replace(/server localhost:3000/g, `server localhost:${options.frontendPort}`);
    
    // Replace domain
    config = config.replace(/learn2play\.local/g, options.domain);
    config = config.replace(/learn2play\.com/g, options.domain);
    
    // Handle SSL configuration
    if (!options.sslEnabled) {
      // Remove HTTPS server block and redirect
      config = config.replace(/# HTTPS server configuration[\s\S]*$/m, '');
    }
    
    // Add generation timestamp
    const timestamp = new Date().toISOString();
    config = `# Generated on ${timestamp} for ${options.environment} environment\n` + config;
    
    return config;
  }

  /**
   * Generate and save configuration file
   */
  generateAndSave(options: NginxConfigOptions): string {
    const config = this.generateConfig(options);
    
    const outputPath = options.outputPath || 
      path.join(this.projectRoot, 'nginx', `${options.environment}.conf`);
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, config);
    
    console.log(`✅ Generated nginx configuration: ${outputPath}`);
    return outputPath;
  }

  /**
   * Generate configurations for both environments
   */
  generateBothEnvironments(baseOptions: Omit<NginxConfigOptions, 'environment'>): { blue: string; green: string } {
    const blueOptions: NginxConfigOptions = {
      ...baseOptions,
      environment: 'blue'
    };
    
    const greenOptions: NginxConfigOptions = {
      ...baseOptions,
      environment: 'green',
      backendPort: baseOptions.backendPort + 100,
      frontendPort: baseOptions.frontendPort + 100
    };
    
    const bluePath = this.generateAndSave(blueOptions);
    const greenPath = this.generateAndSave(greenOptions);
    
    return { blue: bluePath, green: greenPath };
  }

  /**
   * Switch active configuration
   */
  switchActiveConfig(environment: 'blue' | 'green', symlinkPath?: string): void {
    const configPath = path.join(this.projectRoot, 'nginx', `${environment}.conf`);
    const activePath = symlinkPath || path.join(this.projectRoot, 'nginx', 'active.conf');
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    // Remove existing symlink if it exists
    if (fs.existsSync(activePath)) {
      fs.unlinkSync(activePath);
    }
    
    // Create new symlink
    fs.symlinkSync(path.relative(path.dirname(activePath), configPath), activePath);
    
    console.log(`✅ Switched active nginx configuration to ${environment}`);
  }

  /**
   * Validate nginx configuration
   */
  async validateConfig(configPath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const { spawn } = await import('child_process');
      
      return new Promise((resolve) => {
        const process = spawn('nginx', ['-t', '-c', configPath], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        process.stdout?.on('data', (data) => {
          output += data.toString();
        });

        process.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve({ valid: true });
          } else {
            resolve({ valid: false, error: errorOutput || output });
          }
        });

        process.on('error', (error) => {
          resolve({ valid: false, error: error.message });
        });
      });
    } catch (error) {
      return { valid: false, error: 'nginx command not available' };
    }
  }

  /**
   * Reload nginx configuration
   */
  async reloadNginx(): Promise<{ success: boolean; error?: string }> {
    try {
      const { spawn } = await import('child_process');
      
      return new Promise((resolve) => {
        const process = spawn('nginx', ['-s', 'reload'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let errorOutput = '';

        process.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: errorOutput });
          }
        });

        process.on('error', (error) => {
          resolve({ success: false, error: error.message });
        });
      });
    } catch (error) {
      return { success: false, error: 'nginx command not available' };
    }
  }

  private findProjectRoot(): string {
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    return process.cwd();
  }
}

// CLI interface
if (require.main === module) {
  const generator = new NginxConfigGenerator();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'generate':
      const environment = process.argv[3] as 'blue' | 'green';
      const domain = process.argv[4] || 'localhost';
      const backendPort = parseInt(process.argv[5] || '3001', 10);
      const frontendPort = parseInt(process.argv[6] || '3000', 10);
      const sslEnabled = process.argv[7] === 'true';
      
      if (!environment || !['blue', 'green'].includes(environment)) {
        console.error('Usage: generate <blue|green> [domain] [backendPort] [frontendPort] [sslEnabled]');
        process.exit(1);
      }
      
      try {
        generator.generateAndSave({
          environment,
          domain,
          backendPort,
          frontendPort,
          sslEnabled
        });
      } catch (error) {
        console.error('❌ Failed to generate configuration:', error);
        process.exit(1);
      }
      break;
      
    case 'generate-both':
      const bothDomain = process.argv[3] || 'localhost';
      const bothBackendPort = parseInt(process.argv[4] || '3001', 10);
      const bothFrontendPort = parseInt(process.argv[5] || '3000', 10);
      const bothSslEnabled = process.argv[6] === 'true';
      
      try {
        generator.generateBothEnvironments({
          domain: bothDomain,
          backendPort: bothBackendPort,
          frontendPort: bothFrontendPort,
          sslEnabled: bothSslEnabled
        });
      } catch (error) {
        console.error('❌ Failed to generate configurations:', error);
        process.exit(1);
      }
      break;
      
    case 'switch':
      const switchEnv = process.argv[3] as 'blue' | 'green';
      
      if (!switchEnv || !['blue', 'green'].includes(switchEnv)) {
        console.error('Usage: switch <blue|green>');
        process.exit(1);
      }
      
      try {
        generator.switchActiveConfig(switchEnv);
      } catch (error) {
        console.error('❌ Failed to switch configuration:', error);
        process.exit(1);
      }
      break;
      
    case 'validate':
      const validatePath = process.argv[3];
      
      if (!validatePath) {
        console.error('Usage: validate <config-path>');
        process.exit(1);
      }
      
      generator.validateConfig(validatePath).then(result => {
        if (result.valid) {
          console.log('✅ Nginx configuration is valid');
        } else {
          console.error('❌ Nginx configuration is invalid:', result.error);
          process.exit(1);
        }
      }).catch(error => {
        console.error('❌ Failed to validate configuration:', error);
        process.exit(1);
      });
      break;
      
    case 'reload':
      generator.reloadNginx().then(result => {
        if (result.success) {
          console.log('✅ Nginx reloaded successfully');
        } else {
          console.error('❌ Failed to reload nginx:', result.error);
          process.exit(1);
        }
      }).catch(error => {
        console.error('❌ Failed to reload nginx:', error);
        process.exit(1);
      });
      break;
      
    default:
      console.log('Usage:');
      console.log('  generate <blue|green> [domain] [backendPort] [frontendPort] [sslEnabled]');
      console.log('  generate-both [domain] [backendPort] [frontendPort] [sslEnabled]');
      console.log('  switch <blue|green>');
      console.log('  validate <config-path>');
      console.log('  reload');
      process.exit(1);
  }
}

export default NginxConfigGenerator;