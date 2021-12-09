import {
  ObjectType,
  Field,
  Float,
  InputType,
  Int,
  registerEnumType,
} from "@nestjs/graphql";
import { Type } from "class-transformer";
import { IsNumber, IsString, Max, Min } from "class-validator";
import { CoreEntity } from "src/common/entities/core.entity";
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { Category } from "./category.entity";
import { Review } from "./review.entity";

export enum ProductStatus {
  SOLDOUT = "SOLDOUT",
  INSTOCK = "INSTOCK",
}

registerEnumType(ProductStatus, { name: "ProductStatus" });

@InputType("ProductInputType", { isAbstract: true })
@ObjectType()
@Entity()
export class Product extends CoreEntity {

  @Field(() => String)
  @Type(() => String)
  @Column({ type: String })
  @IsString()
  title: string;

  @Field(() => String)
  @Column({ type: String })
  @IsString()
  description: string;

  @Column({ type: String, nullable: false, unique: true })
  @Field(() => String)
  slug: string;

  @OneToMany(() => ProductImageItem, (productItem) => productItem.product)
  images: ProductImageItem[];

  @Field(() => Float)
  @Column({ type: Number, nullable: false })
  @IsNumber()
  @Min(1)
  price: number;

  @Field(() => Int)
  @Column({ type: Number, nullable: false, default: 0 })
  @IsNumber()
  @Min(1)
  views: number;

  @Field(() => Float)
  @Column({ type: Number, nullable: false })
  @IsNumber()
  @Max(99)
  discount: number;

  @Field(() => Boolean)
  @Column({ type: Boolean, default: false })
  showRemaining: boolean;

  @ManyToOne(() => Category, (category) => category.products, {
    nullable: true,
    onDelete: "SET NULL",
  })
  category: Category;

  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];

  @BeforeInsert()
  async createSlug () {
    if (this.title) {
      this.slug = `${this.title
        .toLocaleLowerCase()
        .replace(/ /g, "")}${Date.now()}`;
    }
  }
}

@ObjectType()
@Entity()
@InputType("ProductImageItemInputType", { isAbstract: true })
export class ProductImageItem extends CoreEntity {
  @Column({ type: String })
  @Field(() => String)
  @IsString()
  imageUrl: string;

  @ManyToOne(() => Product, (product) => product.images, {
    onDelete: "CASCADE",
  })
  product: Product;
}

@ObjectType()
@Entity()
@InputType("ProductEntryInputType", { isAbstract: true })
export class ProductEntry extends CoreEntity {
  @CreateDateColumn({ select: true })
  @Type(() => Date)
  @Field(() => Date)
  entryDate: Date;

  @Column({ type: Number, nullable: false })
  @Field(() => Int)
  @IsNumber()
  @Min(1)
  amount: number;

  @ManyToOne(() => Product, (product) => product.images, {
    onDelete: "CASCADE",
  })
  product: Product;

  // on delete reduce amount
}