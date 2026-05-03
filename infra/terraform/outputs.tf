# ── VPC ───────────────────────────────────────────────────────────────────────

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

# ── Subnets ───────────────────────────────────────────────────────────────────

output "public_subnet_ids" {
  description = "IDs of the two public subnets"
  value       = [aws_subnet.public_a.id, aws_subnet.public_b.id]
}

output "private_subnet_ids" {
  description = "IDs of the two private subnets"
  value       = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

output "public_subnet_a_id" {
  description = "ID of the public subnet in AZ-A"
  value       = aws_subnet.public_a.id
}

output "public_subnet_b_id" {
  description = "ID of the public subnet in AZ-B"
  value       = aws_subnet.public_b.id
}

output "private_subnet_a_id" {
  description = "ID of the private subnet in AZ-A"
  value       = aws_subnet.private_a.id
}

output "private_subnet_b_id" {
  description = "ID of the private subnet in AZ-B"
  value       = aws_subnet.private_b.id
}

# ── ECS ───────────────────────────────────────────────────────────────────────

output "ecs_cluster_id" {
  description = "ID of the ECS Fargate cluster"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS Fargate cluster"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_cluster_name" {
  description = "Name of the ECS Fargate cluster"
  value       = aws_ecs_cluster.main.name
}

# ── RDS ───────────────────────────────────────────────────────────────────────

output "rds_endpoint" {
  description = "Connection endpoint of the RDS PostgreSQL instance"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  description = "Hostname of the RDS PostgreSQL instance (without port)"
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "Port of the RDS PostgreSQL instance"
  value       = aws_db_instance.postgres.port
}

output "rds_db_name" {
  description = "Name of the initial database on the RDS instance"
  value       = aws_db_instance.postgres.db_name
}

output "rds_master_user_secret_arn" {
  description = "ARN of the Secrets Manager secret holding the RDS master password (managed by AWS)"
  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
}

# ── ElastiCache ───────────────────────────────────────────────────────────────

output "redis_cluster_id" {
  description = "ID of the ElastiCache Redis cluster"
  value       = aws_elasticache_cluster.redis.id
}

output "redis_endpoint" {
  description = "Connection endpoint of the ElastiCache Redis node"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_port" {
  description = "Port of the ElastiCache Redis cluster"
  value       = aws_elasticache_cluster.redis.port
}

# ── S3 ────────────────────────────────────────────────────────────────────────

output "s3_assets_bucket_name" {
  description = "Name of the S3 assets bucket"
  value       = aws_s3_bucket.assets.id
}

output "s3_assets_bucket_arn" {
  description = "ARN of the S3 assets bucket"
  value       = aws_s3_bucket.assets.arn
}

output "s3_assets_bucket_domain_name" {
  description = "Regional domain name of the S3 assets bucket (for CloudFront origins)"
  value       = aws_s3_bucket.assets.bucket_regional_domain_name
}

# ── ALB ───────────────────────────────────────────────────────────────────────

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Canonical hosted zone ID of the ALB (for Route 53 alias records)"
  value       = aws_lb.main.zone_id
}

output "alb_target_group_arn" {
  description = "ARN of the ALB target group for the application"
  value       = aws_lb_target_group.app.arn
}

# ── Route 53 ──────────────────────────────────────────────────────────────────

output "route53_zone_id" {
  description = "Zone ID of the Route 53 hosted zone (empty string if zone not created)"
  value       = var.route53_zone_name != "" ? aws_route53_zone.main[0].zone_id : ""
}

output "route53_zone_name_servers" {
  description = "Name servers for the Route 53 hosted zone (empty list if zone not created)"
  value       = var.route53_zone_name != "" ? aws_route53_zone.main[0].name_servers : []
}

# ── Secrets Manager ───────────────────────────────────────────────────────────

output "secret_arn_app_secrets" {
  description = "ARN of the Secrets Manager secret for application runtime secrets"
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "secret_arn_redis_auth" {
  description = "ARN of the Secrets Manager secret for the Redis AUTH token"
  value       = aws_secretsmanager_secret.redis_auth.arn
}

output "secret_arn_db_password" {
  description = "ARN of the Secrets Manager secret stub for the RDS master password"
  value       = aws_secretsmanager_secret.db_password.arn
}

# ── Security Groups ───────────────────────────────────────────────────────────

output "sg_alb_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "sg_ecs_tasks_id" {
  description = "ID of the ECS tasks security group"
  value       = aws_security_group.ecs_tasks.id
}

output "sg_rds_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

output "sg_redis_id" {
  description = "ID of the ElastiCache Redis security group"
  value       = aws_security_group.redis.id
}

# ── Convenience ───────────────────────────────────────────────────────────────

output "name_prefix" {
  description = "Common name prefix used for all resources (project-environment)"
  value       = local.name_prefix
}

output "environment" {
  description = "Active environment / workspace"
  value       = var.environment
}
