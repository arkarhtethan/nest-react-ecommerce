import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { JwtService } from '../jwt/jwt.service'
import { Repository } from 'typeorm'
import {
  ChangePasswordInput,
  changePasswordOutput,
} from './dto/change-password.dto'
import { CreateUserInput, CreateUserOutput } from './dto/create-user.dto'
import { DeleteUserOutput } from './dto/delete-user.dto'
import { GetUserInput, GetUserOutput } from './dto/get-user.dto'
import { GetUsersOutput } from './dto/get-users.dto'
import { LoginInput, LoginOutput } from './dto/login.dto'
import { MyProfileOutput } from './dto/my-profile.dto'
import { UpdateUserInput, UpdateUserOutput } from './dto/update-user.dto'
import { User } from './entities/user.entity'
import { Verification } from './entities/verification.entity'
import { VerifyEmailInput, VerifyEmailOutput } from './dto/verify-email.dto'
import { UploadProfilePictureOutput } from './dto/upload-profile-picture.dto'
import { ConfigService } from '@nestjs/config'
import {
  extractFileNameFromUrl,
  removeProfilePicture,
} from 'src/utils/file.utils'
import { CoreOutput } from 'src/common/dtos/core.output'
import { ToggleDisableInput } from './dto/toggle-disable-status.dto'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { PaginationInput, PaginationOutput } from '../common/dtos/pagination.output'
import { UpdateUserRoleInput, UpdateUserRoleOutput } from './dto/update-user-role.dto'

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    private readonly jwtService: JwtService,
    private configService: ConfigService,
    @InjectPinoLogger(UserService.name)
    private readonly logger: PinoLogger
  ) { }

  private async toggleDisableStatus (
    userId: number,
    disable: boolean
  ): Promise<CoreOutput> {
    try {
      const user = await this.usersRepository.findOne({ id: userId })
      if (!user) {
        throw new HttpException('User not found.', HttpStatus.BAD_REQUEST)
      }
      user.disabled = disable

      await this.usersRepository.save(user)

      return {
        ok: true,
      }
    } catch (error) {
      if (error.name && error.name === 'HttpException') {
        throw error
      }
      return {
        ok: false,
        error: 'Email Verification Failed',
      }
    }
  }

  async register (createUserDto: CreateUserInput): Promise<CreateUserOutput> {
    try {
      const user = await this.usersRepository.create({
        ...createUserDto,
        verified: true,
      })
      await this.usersRepository.save(user)
      // await this.verificationRepository.save(
      //   this.verificationRepository.create({ user })
      // );
      // //  send email here
      return {
        ok: true,
      }
    } catch (error) {
      if (error.code && error.code === '23505') {
        throw new HttpException(
          `User with this email already exists.`,
          HttpStatus.BAD_REQUEST
        )
      }
      return {
        ok: false,
        error: 'Cannot create user.',
      }
    }
  }

  async login ({ email, password }: LoginInput): Promise<LoginOutput> {
    try {
      const user = await this.usersRepository.findOne(
        { email },
        { select: ['email', 'password', 'verified', 'disabled'] }
      )
      if (!user) {
        throw new HttpException(
          'Invalid email / password.',
          HttpStatus.BAD_REQUEST
        )
      }
      if (!user.verified) {
        throw new HttpException(
          'You need to verify your email first.',
          HttpStatus.BAD_REQUEST
        )
      }
      if (!(await user.checkPassword(password))) {
        throw new HttpException('Incorrect Password', HttpStatus.BAD_REQUEST)
      }
      if (user.disabled) {
        throw new HttpException(
          'Your account has been disabled.',
          HttpStatus.BAD_REQUEST
        )
      }
      // generate token
      const loggedInUser = await this.usersRepository.findOne(
        { email },
        { relations: ['addresses'] }
      )
      const token = await this.jwtService.sign(loggedInUser.id)
      return {
        ok: true,
        user: loggedInUser,
        token,
      }
    } catch (error) {
      if (error.status === 400) {
        throw error
      }
      return {
        ok: false,
        error: 'Login Failed.',
      }
    }
  }

  async getUsers ({ limit, pageNumber }: PaginationInput): Promise<GetUsersOutput> {
    try {
      const totalUsers = await this.usersRepository.count();
      const totalPages = Math.ceil(totalUsers / limit);
      if (pageNumber > totalPages) {
        pageNumber = totalPages;
      }
      const users = await this.usersRepository.find({
        relations: ["orders",],
        take: limit,
        order: {
          id: "DESC"
        },
        skip: (pageNumber * limit - limit),
      });

      return {
        ok: true,
        data: {
          users,
          limit,
          totalPages,
          totalItems: totalUsers,
          currentPage: pageNumber,
          currentPageItems: users.length,
        }
      }
    } catch (error) {
      this.logger.error(error)
      return {
        ok: false,
        error: 'Cannot get all users.',
      }
    }
  }

  async getUser ({ id }: GetUserInput): Promise<GetUserOutput> {
    try {
      const user = await this.usersRepository.findOne({ id }, { relations: ['addresses', 'orders'] })
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND)
      }
      return {
        ok: true,
        user,
      }
    } catch (error) {
      if (error && error.name && error.name === 'HttpException') {
        throw error
      }
      return {
        ok: false,
        error: 'Cannot get user.',
      }
    }
  }

  async update (
    { name, email, bio }: UpdateUserInput,
    authUser: User
  ): Promise<UpdateUserOutput> {
    try {
      const { id } = authUser
      let user = await this.usersRepository.findOne({ id })
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND)
      }
      if (email) {
        user.email = email
        // user.verified = false;

        // await this.verificationRepository.delete({ user: { id: user.id } });
        // await this.verificationRepository.save(
        //   this.verificationRepository.create({ user })
        // );
      }

      if (name) {
        user.name = name
      }

      if (bio) {
        user.bio = bio
      }

      await this.usersRepository.save(user)
      user = await this.usersRepository.findOne({ id })

      return {
        ok: true,
        user,
      }
    } catch (error) {
      if (error.name && error.name === 'HttpException') {
        throw error
      }
      return {
        ok: false,
        error: 'Cannot update users.',
      }
    }
  }

  async changePassword (
    { oldPassword, newPassword }: ChangePasswordInput,
    authUser: User
  ): Promise<changePasswordOutput> {
    try {
      const { id } = authUser
      let user = await this.usersRepository.findOne(
        { id },
        { select: ['password'] }
      )
      if (!user) {
        throw new HttpException('User not found.', HttpStatus.NOT_FOUND)
      }
      const isPasswordCorrect = await user.checkPassword(oldPassword)
      if (!isPasswordCorrect) {
        throw new HttpException('Incorrect Password', HttpStatus.BAD_REQUEST)
      }
      if (await user.checkPassword(newPassword)) {
        throw new HttpException(
          "New password can't be same with old password",
          HttpStatus.BAD_REQUEST
        )
      }
      user = await this.usersRepository.findOne({ id })
      user.password = newPassword
      await this.usersRepository.save(user)
      return {
        ok: true,
      }
    } catch (error) {
      if (error.name === 'HttpException') {
        throw error
      }
      return {
        ok: false,
        error: 'Cannot change password.',
      }
    }
  }

  async myProfile ({ id }: User): Promise<MyProfileOutput> {
    try {
      const user = await this.usersRepository.findOne({ id })
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND)
      }
      return {
        ok: true,
        user,
      }
    } catch (error) {
      if (error.name && error.name === 'HttpException') {
        throw error
      }
      return {
        ok: false,
        error: 'Cannot get user.',
      }
    }
  }

  async deleteAccount (authUser: User): Promise<DeleteUserOutput> {
    try {
      const { id } = authUser
      const user = await this.usersRepository.findOne({ id })
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND)
      }
      await this.usersRepository.delete({ id })
      return {
        ok: true,
      }
    } catch (error) {
      if (error.name && error.name === 'HttpException') {
        throw error
      }
      return {
        ok: false,
        error: 'Cannot delete users.',
      }
    }
  }

  async verifyEmail ({ code }: VerifyEmailInput): Promise<VerifyEmailOutput> {
    try {
      const verification = await this.verificationRepository.findOne(
        { code },
        { relations: ['user'] }
      )

      if (!verification) {
        throw new HttpException(
          'Invalid verification code',
          HttpStatus.BAD_REQUEST
        )
      }

      const user = await this.usersRepository.findOne({
        id: verification.user.id,
      })
      user.verified = true

      await this.verificationRepository.delete({ user: { id: user.id } })

      await this.usersRepository.save(user)

      return {
        ok: true,
      }
    } catch (error) {
      if (error.name && error.name === 'HttpException') {
        throw error
      }
      return {
        ok: false,
        error: 'Email Verification Failed',
      }
    }
  }

  async enableAccount ({ userId }: ToggleDisableInput): Promise<CoreOutput> {
    return this.toggleDisableStatus(userId, false)
  }

  async disableAccount ({ userId }: ToggleDisableInput): Promise<CoreOutput> {
    return this.toggleDisableStatus(userId, true)
  }

  async findOne ({ id }: GetUserInput): Promise<GetUserOutput> {
    try {
      const user = await this.usersRepository.findOne({ id })
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND)
      }
      return {
        ok: true,
        user,
      }
    } catch (error) {
      if (error && error.name && error.name === 'HttpException') {
        throw error
      }
      return {
        ok: false,
        error: 'Cannot get user.',
      }
    }
  }

  async updateUserRole ({ userId, role }: UpdateUserRoleInput): Promise<UpdateUserRoleOutput> {
    try {
      const user = await this.usersRepository.findOne({ id: userId });
      if (!user) {
        throw new HttpException('User not found,', HttpStatus.NOT_FOUND)
      }
      user.role = role;
      await this.usersRepository.save(user);
      return {
        ok: true,
      }
    } catch (error) {
      if (error.name && error.name === 'HttpException') {
        throw error
      }
      return {
        ok: false,
        error: 'Role update failed.',
      }
    }
  }

}
