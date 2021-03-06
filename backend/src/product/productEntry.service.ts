import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User, UserRole } from "src/user/entities/user.entity";
import { Repository } from "typeorm";
import { CreateProductEntryInput, CreateProductEntryOutput } from "./dto/productEntry/create-entry.dto";
import { GetProductEntriesByProductInput, GetProductEntriesInput, GetProductEntriesOutput } from "./dto/productEntry/get-product-entries.dto";
import { GetProductEntryInput, GetProductEntryOutput } from "./dto/productEntry/get-product-entry.dto";
import { ProductEntryDeleteInput, ProductEntryDeleteOutput } from "./dto/productEntry/product-entry-delete.dto";
import { UpdateProductEntryInput, UpdateProductEntryOutput } from "./dto/productEntry/update-product-entry.dto";
import { Product, ProductEntry } from "./entities/product.entity";

@Injectable()
export class ProductEntryService {
    constructor(
        @InjectRepository(ProductEntry)
        private readonly productEntryRepository: Repository<ProductEntry>,
        @InjectRepository(Product)
        private readonly productRepository: Repository<Product>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) { }

    async createProductEntry (
        createProductEntryInput: CreateProductEntryInput,
        user: User
    )
        : Promise<CreateProductEntryOutput> {
        try {
            if (user.role !== UserRole.Admin) {
                throw new HttpException('Permission denied.', HttpStatus.UNAUTHORIZED)
            }
            const product = await this.productRepository.findOne({ id: createProductEntryInput.productId })
            if (!product) {
                throw new HttpException('Product not found.', HttpStatus.NOT_FOUND);
            }
            const productEntry = await this.productEntryRepository.create({ ...createProductEntryInput, user, product })
            product.quantity += createProductEntryInput.amount;
            await this.productEntryRepository.save(productEntry);
            await this.productRepository.save(product);
            return {
                ok: true,
            }
        } catch (error) {
            if (error.name && error.name === "HttpException") {
                throw error;
            }
            return {
                ok: false,
                error: "Can't create product.",
            };
        }
    }

    async updateProductEntry (updateProductEntryInput: UpdateProductEntryInput)
        : Promise<UpdateProductEntryOutput> {
        try {
            const productEntry = await this.productEntryRepository.findOne({ id: updateProductEntryInput.id }, { relations: ['product'] })
            if (!productEntry) {
                throw new HttpException("Product not found.", HttpStatus.NOT_FOUND);
            }
            if (updateProductEntryInput.amount) {
                // modifiedprodcut
                const product = await this.productRepository.findOne({ id: productEntry.product.id })
                const newAmount = product.quantity - productEntry.amount + updateProductEntryInput.amount;
                product.quantity = newAmount;
                await this.productRepository.save(product);
            }
            await this.productEntryRepository.update(updateProductEntryInput.id, { ...updateProductEntryInput })
            return {
                ok: true,
            }
        } catch (error) {
            if (error.name && error.name === "HttpException") {
                throw error;
            }
            return {
                ok: false,
                error: "Can't create product.",
            };
        }
    }

    async deleteProductEntry ({ id, reduceAmount }: ProductEntryDeleteInput)
        : Promise<ProductEntryDeleteOutput> {
        try {
            const productEntry = await this.productEntryRepository.findOne({ id }, { relations: ['product'] })
            if (!productEntry) {
                throw new HttpException("Product not found.", HttpStatus.NOT_FOUND);
            }
            if (reduceAmount) {
                const product = await this.productRepository.findOne({ id: productEntry.product.id })
                if (product.quantity >= productEntry.amount) {
                    product.quantity -= productEntry.amount;
                    await this.productRepository.save(product);
                }
            }
            await this.productEntryRepository.delete({ id })
            return {
                ok: true,
            }
        } catch (error) {
            if (error.name && error.name === "HttpException") {
                throw error;
            }
            return {
                ok: false,
                error: "Can't create product.",
            };
        }
    }

    async getProductEntriesByUser ({ userId, limit, pageNumber }: GetProductEntriesInput)
        : Promise<GetProductEntriesOutput> {
        try {
            const user = await this.userRepository.findOne({ id: userId });
            if (!user) {
                throw new HttpException("User not found.", HttpStatus.NOT_FOUND);
            }
            const productEntriesCount = await this.productEntryRepository.count({ where: { user } })
            const totalPages = Math.ceil(productEntriesCount / limit);
            if (pageNumber > totalPages) {
                pageNumber = totalPages;
            }
            const productEntries = await this.productEntryRepository.find({
                relations: ['product'],
                where: { user },
                take: limit,
                order: {
                    id: "DESC"
                },
                skip: (pageNumber * limit - limit),
            });
            return {
                ok: true,
                data: {
                    productEntries,
                    limit,
                    totalPages,
                    totalItems: productEntriesCount,
                    currentPage: pageNumber,
                    currentPageItems: productEntries.length,
                }

            }
        } catch (error) {
            if (error.name && error.name === "HttpException") {
                throw error;
            }
            return {
                ok: false,
                error: "Can't create product.",
            };
        }
    }

    async getProductEntriesByProduct ({ limit, pageNumber, productId }: GetProductEntriesByProductInput)
        : Promise<GetProductEntriesOutput> {
        try {
            const product = await this.productRepository.findOne({ id: productId });
            if (!product) {
                throw new HttpException("User not found.", HttpStatus.NOT_FOUND);
            }
            const productEntriesCount = await this.productEntryRepository.count({ where: { product } })
            const totalPages = Math.ceil(productEntriesCount / limit);
            if (pageNumber > totalPages) {
                pageNumber = totalPages;
            }
            const productEntries = await this.productEntryRepository.find({
                relations: ['product', 'user'],
                where: { product },
                take: limit,
                order: {
                    id: "DESC"
                },
                skip: (pageNumber * limit - limit),
            });
            return {
                ok: true,
                data: {
                    productEntries,
                    limit,
                    totalPages,
                    totalItems: productEntriesCount,
                    currentPage: pageNumber,
                    currentPageItems: productEntries.length,
                }

            }
        } catch (error) {
            if (error.name && error.name === "HttpException") {
                throw error;
            }
            return {
                ok: false,
                error: "Can't create product.",
            };
        }
    }

    async getProductEntry ({ id }: GetProductEntryInput): Promise<GetProductEntryOutput> {
        try {
            const productEntry = await this.productEntryRepository.findOne({ id })
            if (!productEntry) {
                throw new HttpException("Product not found.", HttpStatus.NOT_FOUND);
            }
            return {
                ok: true,
                productEntry,
            }
        } catch (error) {
            if (error.name && error.name === "HttpException") {
                throw error;
            }
            return {
                ok: false,
                error: "Can't create product.",
            };
        }
    }
}
