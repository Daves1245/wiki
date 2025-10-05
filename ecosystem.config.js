module.exports = {
	apps: [
		{
			name: 'wiki',
			script: 'docker compose up --build -d',
			cwd: '/home/dsantamaria/wiki',
			log_file: './logs/all.log',
			out_file: './logs/out.log',
			error_file: './logs/error.log'
		}
	]
}

