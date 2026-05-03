variable "project_name" {
  description = "Name of the project, used as a prefix for all resources"
  type        = string
  default     = "nexus"
}

variable "environment" {
  description = "Deployment environment — must be 'dev' or 'staging' to match Terraform workspaces"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging"], var.environment)
    error_message = "environment must be one of: dev, staging."
  }
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

# ── VPC ──────────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for the two public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for the two private subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

# ── ECS ──────────────────────────────────────────────────────────────────────

variable "ecs_container_insights" {
  description = "Enable CloudWatch Container Insights on the ECS cluster"
  type        = string
  default     = "enabled"

  validation {
    condition     = contains(["enabled", "disabled"], var.ecs_container_insights)
    error_message = "ecs_container_insights must be 'enabled' or 'disabled'."
  }
}

# ── RDS ──────────────────────────────────────────────────────────────────────

variable "db_name" {
  description = "Name of the initial PostgreSQL database"
  type        = string
  default     = "nexusdb"
}

variable "db_username" {
  description = "Master username for the RDS instance (password stored in Secrets Manager)"
  type        = string
  default     = "nexusadmin"
}

variable "db_instance_class" {
  description = "RDS instance type"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage for RDS in GiB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum storage autoscaling limit for RDS in GiB"
  type        = number
  default     = 100
}

variable "db_backup_retention_period" {
  description = "Number of days to retain automated RDS backups"
  type        = number
  default     = 7
}

variable "db_deletion_protection" {
  description = "Enable deletion protection on the RDS instance"
  type        = bool
  default     = false
}

variable "db_multi_az" {
  description = "Enable Multi-AZ standby for RDS"
  type        = bool
  default     = false
}

# ── ElastiCache ──────────────────────────────────────────────────────────────

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes in the ElastiCache cluster"
  type        = number
  default     = 1
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

# ── S3 ───────────────────────────────────────────────────────────────────────

variable "s3_force_destroy" {
  description = "Allow Terraform to destroy the S3 bucket even when non-empty (set true for dev only)"
  type        = bool
  default     = false
}

# ── ALB ──────────────────────────────────────────────────────────────────────

variable "alb_idle_timeout" {
  description = "ALB connection idle timeout in seconds"
  type        = number
  default     = 60
}

variable "alb_deletion_protection" {
  description = "Enable deletion protection on the ALB"
  type        = bool
  default     = false
}

# ── Route 53 ─────────────────────────────────────────────────────────────────

variable "route53_zone_name" {
  description = "Domain name for the Route 53 hosted zone (e.g. example.com). Leave empty to skip zone creation."
  type        = string
  default     = ""
}

# ── Common tags ───────────────────────────────────────────────────────────────

variable "additional_tags" {
  description = "Additional resource tags merged with the default tag set"
  type        = map(string)
  default     = {}
}
