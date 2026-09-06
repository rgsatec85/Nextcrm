import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  async create(
    user: AuthenticatedUser,
    customerId: string,
    dto: CreateContactDto,
  ) {
    await this.customersService.assertAccessible(user, customerId);

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.contact.create({
        data: {
          tenantId: user.tenantId,
          customerId,
          name: dto.name,
          role: dto.role,
          email: dto.email,
          phone: dto.phone,
          whatsapp: dto.whatsapp,
          isPrimary: dto.isPrimary ?? false,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      }),
    );
  }

  async findAll(user: AuthenticatedUser, customerId: string) {
    await this.customersService.assertAccessible(user, customerId);

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.contact.findMany({
        where: { tenantId: user.tenantId, customerId },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  async update(
    user: AuthenticatedUser,
    customerId: string,
    contactId: string,
    dto: UpdateContactDto,
  ) {
    await this.customersService.assertAccessible(user, customerId);

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      const existing = await tx.contact.findFirst({
        where: { id: contactId, tenantId: user.tenantId, customerId },
      });
      if (!existing) {
        throw new NotFoundException('Contato não encontrado');
      }

      return tx.contact.update({
        where: { id: contactId },
        data: { ...dto, updatedBy: user.sub },
      });
    });
  }

  async remove(user: AuthenticatedUser, customerId: string, contactId: string) {
    await this.customersService.assertAccessible(user, customerId);

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      const existing = await tx.contact.findFirst({
        where: { id: contactId, tenantId: user.tenantId, customerId },
      });
      if (!existing) {
        throw new NotFoundException('Contato não encontrado');
      }

      await tx.contact.delete({ where: { id: contactId } });
      return { id: contactId };
    });
  }
}
